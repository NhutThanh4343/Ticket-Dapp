import { readFile, writeFile } from 'node:fs/promises';

const artifact = JSON.parse(await readFile(new URL('../artifacts/contracts/TourTicketContract.sol/TourTicketContract.json', import.meta.url), 'utf8'));
await writeFile(new URL('../src/contracts/tourTicketAbi.js', import.meta.url),
  '// Generated from the compiled TourTicketContract artifact. Re-export after compiling changes.\nexport const tourTicketAbi = ' + JSON.stringify(artifact.abi, null, 2) + ';\n');
console.log('Exported TourTicketContract ABI.');
await writeFile(new URL('../src/contracts/deploymentBytecode.js', import.meta.url),
  '// Generated from the compiled TourTicketContract artifact.\nexport const deploymentBytecode = ' + JSON.stringify(artifact.bytecode) + ';\n');
