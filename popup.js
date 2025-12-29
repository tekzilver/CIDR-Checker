document.addEventListener('DOMContentLoaded', () => {
    const ipInput = document.getElementById('ipAddress');
    const cidrInput = document.getElementById('cidrBlock');
    const checkBtn = document.getElementById('checkBtn');
    const resultArea = document.getElementById('result-area');

    checkBtn.addEventListener('click', () => {
        const ipStr = ipInput.value.trim();
        const cidrStr = cidrInput.value.trim();

        if (!ipStr || !cidrStr) {
            showResult('error', 'Missing Input', 'Please enter both an IP address and a CIDR block.');
            return;
        }

        // User Error Check: Did they paste CIDR into the IP field?
        if (ipStr.includes('/')) {
            showResult('error', 'Input Error', 'You entered a CIDR block (contains /) in the "IP Address" field.<br>Please put ONLY the IP address in the top box.');
            return;
        }
        
        // User Error Check: Did they paste an IP into the CIDR field?
        if (!cidrStr.includes('/')) {
            showResult('error', 'Input Error', 'The CIDR Block field is missing a slash "/".<br>Format example: 192.168.1.0/24');
            return;
        }

        try {
            const version = detectIPVersion(ipStr, cidrStr);
            
            let isMatch = false;

            if (version === 4) {
                isMatch = checkIPv4(ipStr, cidrStr);
            } else if (version === 6) {
                isMatch = checkIPv6(ipStr, cidrStr);
            } else {
                throw new Error('IP version mismatch or invalid format.');
            }

            if (isMatch) {
                showResult('success', 'Match Found', `The IP ${ipStr} belongs to the network ${cidrStr}.`);
            } else {
                showResult('error', 'No Match', `The IP ${ipStr} is NOT in the range ${cidrStr}.`);
            }

        } catch (err) {
            console.error(err);
            showResult('error', 'Validation Error', err.message || 'Please check your input format.');
        }
    });

    function showResult(type, title, message) {
        resultArea.style.display = 'block';
        resultArea.className = type === 'success' ? 'status-success' : 'status-error';
        
        const icon = type === 'success' ? '✔' : '✖';
        
        resultArea.innerHTML = `
            <span class="status-icon">${icon}</span>
            <span class="status-title">${title}</span>
            <span class="status-desc">${message}</span>
        `;
    }

    // --- IPv4 Logic ---
    function checkIPv4(ipStr, cidrStr) {
        const cidrParts = cidrStr.split('/');
        if (cidrParts.length !== 2) {
            throw new Error('Invalid CIDR format. Expected format: x.x.x.x/yy');
        }

        const cidrIp = cidrParts[0].trim();
        const prefixLength = parseInt(cidrParts[1].trim(), 10);

        if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
            throw new Error('Invalid IPv4 prefix length (must be 0-32).');
        }

        const ipNum = ipv4ToNumber(ipStr);
        const cidrNum = ipv4ToNumber(cidrIp);
        const mask = (0xFFFFFFFF << (32 - prefixLength)) >>> 0;

        return (ipNum & mask) === (cidrNum & mask);
    }

    function ipv4ToNumber(ip) {
        // Remove ALL whitespace
        const cleanIp = ip.replace(/\s+/g, '');
        
        const parts = cleanIp.split('.');
        
        if (parts.length !== 4) {
            throw new Error(`Invalid IPv4 format: "${ip}". Expected 4 octets (numbers separated by dots).`);
        }
        
        return parts.reduce((acc, octet) => {
            if (octet === '') throw new Error('Empty octet found (double dots?).');
            
            const val = parseInt(octet, 10);
            
            if (isNaN(val)) throw new Error(`Invalid number found: "${octet}".`);
            if (val < 0 || val > 255) {
                throw new Error(`Octet "${val}" is invalid. IPv4 numbers must be between 0 and 255.`);
            }
            
            return (acc << 8) + val;
        }, 0) >>> 0;
    }

    // --- IPv6 Logic ---
    function checkIPv6(ipStr, cidrStr) {
        const cidrParts = cidrStr.split('/');
        if (cidrParts.length !== 2) {
            throw new Error('Invalid CIDR format.');
        }

        const cidrIp = cidrParts[0].trim();
        const prefixLength = BigInt(parseInt(cidrParts[1].trim(), 10) || 128);

        if (prefixLength < 0n || prefixLength > 128n) {
            throw new Error('Invalid IPv6 prefix length (must be 0-128).');
        }

        const ipBig = ipv6ToBigInt(ipStr);
        const cidrBig = ipv6ToBigInt(cidrIp);

        const shift = 128n - prefixLength;
        
        return (ipBig >> shift) === (cidrBig >> shift);
    }

    function ipv6ToBigInt(ip) {
        let expanded = ip.replace(/\s+/g, '');
        
        if (expanded.includes('::')) {
            const parts = expanded.split('::');
            const left = parts[0].split(':').filter(x => x !== '');
            const right = parts[1].split(':').filter(x => x !== '');
            const missing = 8 - (left.length + right.length);
            
            if (missing < 1) {
                 throw new Error('Too many groups in IPv6 address.');
            }
            
            const fill = Array(missing).fill('0000');
            expanded = [...left, ...fill, ...right].join(':');
        }

        const groups = expanded.split(':');
        if (groups.length !== 8) {
            throw new Error('Invalid IPv6 format. Expected 8 groups.');
        }

        let hexString = '';
        for (let group of groups) {
            if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
                throw new Error(`Invalid IPv6 group: "${group}"`);
            }
            hexString += group.padStart(4, '0');
        }

        return BigInt('0x' + hexString);
    }

    // --- Helper: Detect Version ---
    function detectIPVersion(ipStr, cidrStr) {
        const hasV4Char = (s) => s.includes('.');
        const hasV6Char = (s) => s.includes(':');

        const ipIsV4 = hasV4Char(ipStr);
        const cidrIsV4 = hasV4Char(cidrStr);
        const ipIsV6 = hasV6Char(ipStr);
        const cidrIsV6 = hasV6Char(cidrStr);

        if (ipIsV4 && ipIsV6) throw new Error('IP address is invalid (mixes IPv4 and IPv6 characters).');
        if (cidrIsV4 && cidrIsV6) throw new Error('CIDR block is invalid.');

        if (ipIsV6 || cidrIsV6) {
            if (ipIsV4 || cidrIsV4) {
                throw new Error('IP version mismatch (cannot mix IPv4 and IPv6).');
            }
            return 6;
        }

        return 4;
    }
});