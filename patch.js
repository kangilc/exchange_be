const fs = require('fs');
const paths = [
  'd:/exchange_be/frontend-admin/src/store/useExchangeStore.ts',
  'd:/exchange_be/frontend-admin/src/components/TradingTerminal.tsx',
  'd:/exchange_be/frontend-admin/src/components/tabs/CustodyManagementTab.tsx'
];

paths.forEach(p => {
    if (!fs.existsSync(p)) return;
    let content = fs.readFileSync(p, 'utf8');

    content = content.replace(/([ \t]+)const ([a-zA-Z0-9_]+) = await ([a-zA-Z0-9_]+)\.json\(\);/g, (match, indent, varname, resname) => {
        if (['tokens', 'errData', 'body', 'tickersJson', '_json', 'summary'].includes(varname)) {
            return match;
        }
        return `${indent}const _json_${varname} = await ${resname}.json();\n${indent}const ${varname} = _json_${varname}.data !== undefined ? _json_${varname}.data : _json_${varname};`;
    });

    fs.writeFileSync(p, content, 'utf8');
    console.log('Patched ' + p);
});
