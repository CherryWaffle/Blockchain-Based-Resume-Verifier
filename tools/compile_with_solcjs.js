const fs = require('fs');
const path = require('path');
const https = require('https');

// OpenZeppelin release tag to fetch matching sources
const OZ_TAG = 'v4.9.6';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'solcjs-compiler' } }, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

async function fetchOpenZeppelinFile(ozPath) {
  // ozPath example: @openzeppelin/contracts/access/AccessControl.sol
  const prefix = '@openzeppelin/contracts/';
  if (!ozPath.startsWith(prefix)) throw new Error('Unsupported OZ path: ' + ozPath);
  const rel = ozPath.slice(prefix.length);
  const localPath = path.resolve(__dirname, '..', 'node_modules', '@openzeppelin', 'contracts', rel);
  if (fs.existsSync(localPath)) return fs.readFileSync(localPath, 'utf8');
  const url = `https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/${OZ_TAG}/contracts/${rel}`;
  return await fetchUrl(url);
}

function findImportsInSource(src) {
  const re = /import\s+?(?:\"|\')([^\"']+)(?:\"|\')\s*?;/g;
  const imports = [];
  let m;
  while ((m = re.exec(src)) !== null) imports.push(m[1]);
  return imports;
}

async function resolveAllSources(initialSources, contractsDir) {
  // initialSources: map of fileKey -> { content }
  const sources = Object.assign({}, initialSources);
  const queue = Object.keys(initialSources).slice();

  while (queue.length) {
    const key = queue.shift();
    const content = sources[key].content;
    const imports = findImportsInSource(content);
    for (const imp of imports) {
      // resolve path relative to key if starts with '.'
      let resolved;
      if (imp.startsWith('.')) {
        const dir = path.posix.dirname(key);
        resolved = path.posix.normalize(path.posix.join(dir, imp));
      } else if (imp.startsWith('@openzeppelin')) {
        resolved = imp; // keep as is for fetching
      } else {
        // try to resolve as local contract path
        resolved = imp;
      }

      if (sources[resolved]) continue; // already have

      if (resolved.startsWith('@openzeppelin')) {
        try {
          const txt = await fetchOpenZeppelinFile(resolved);
          sources[resolved] = { content: txt };
          queue.push(resolved);
        } catch (err) {
          throw new Error(`Failed to fetch OpenZeppelin file ${resolved}: ${err.message}`);
        }
      } else {
        // try to read local file from contractsDir
        const localPath = path.resolve(contractsDir, resolved);
        if (fs.existsSync(localPath)) {
          const txt = fs.readFileSync(localPath, 'utf8');
          sources[resolved] = { content: txt };
          queue.push(resolved);
        } else {
          // try resolve relative within node_modules (not supported)
          throw new Error(`Import ${imp} (resolved ${resolved}) not found locally and not an OpenZeppelin import`);
        }
      }
    }
  }

  return sources;
}

async function main() {
  const solc = require('solc');
  const contractsDir = path.resolve(__dirname, '..', 'contracts');
  const buildDir = path.resolve(__dirname, '..', 'build', 'contracts');
  const backendAbiDir = path.resolve(__dirname, '..', 'backend', 'abi');
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
  if (!fs.existsSync(backendAbiDir)) fs.mkdirSync(backendAbiDir, { recursive: true });

  const files = fs.readdirSync(contractsDir).filter(f => f.endsWith('.sol'));
  if (files.length === 0) {
    console.error('No .sol files found in contracts/');
    process.exit(1);
  }

  const initialSources = {};
  for (const file of files) {
    const content = fs.readFileSync(path.join(contractsDir, file), 'utf8');
    // use posix-style filenames as keys
    const key = file;
    initialSources[key] = { content };
  }

  console.log('Resolving imports (will fetch OpenZeppelin sources from GitHub)...');
  const fullSources = await resolveAllSources(initialSources, contractsDir);

  const input = {
    language: 'Solidity',
    sources: fullSources,
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true,
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };

  console.log('Compiling with solc-js...');
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const hasError = output.errors.some(e => e.severity === 'error');
    output.errors.forEach(e => console.log(e.formattedMessage || e.message));
    if (hasError) process.exit(1);
  }

  for (const fileName of Object.keys(output.contracts)) {
    for (const contractName of Object.keys(output.contracts[fileName])) {
      if (contractName !== 'ResumeVerifier') {
        continue;
      }
      const contract = output.contracts[fileName][contractName];
      const out = {
        abi: contract.abi,
        bytecode: contract.evm.bytecode.object
      };
      const outPath = path.join(buildDir, `${contractName}.json`);
      fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
      // also write ABI only to backend/abi
      const abiPath = path.join(backendAbiDir, `${contractName}.json`);
      fs.writeFileSync(abiPath, JSON.stringify({ abi: contract.abi }, null, 2));
      console.log('Wrote', outPath, 'and', abiPath);
    }
  }

  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
