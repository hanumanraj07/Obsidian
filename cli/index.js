import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import figlet from 'figlet';
import { password } from '@inquirer/prompts';
import ora from 'ora';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { spawn } from 'cross-spawn';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

// Load environment variables if they exist
dotenv.config({ path: envPath });

async function showBanner() {
  return new Promise((resolve, reject) => {
    figlet('OBSIDIAN', (err, data) => {
      if (err) return reject(err);
      console.log(chalk.cyan(data));
      console.log(chalk.gray('  AI Agent Decision Audit & Governance\n'));
      resolve();
    });
  });
}

async function validateKey(key) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    });
    return res.status === 200;
  } catch (err) {
    return false;
  }
}

async function getAndValidateKey() {
  let key = process.env.GROQ_API_KEY;

  if (key && await validateKey(key)) {
    return key;
  }

  while (true) {
    key = await password({
      message: 'Enter your Groq API key:',
      mask: '*'
    });

    const spinner = ora('Validating key...').start();
    const isValid = await validateKey(key);

    if (isValid) {
      spinner.succeed('Key validated successfully!');
      // Save key to .env
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
      
      const newEnvContent = envContent.includes('GROQ_API_KEY=') 
        ? envContent.replace(/GROQ_API_KEY=.*/, `GROQ_API_KEY=${key}`)
        : `${envContent}\nGROQ_API_KEY=${key}`.trim();
        
      fs.writeFileSync(envPath, newEnvContent);
      process.env.GROQ_API_KEY = key;
      return key;
    } else {
      spinner.fail(chalk.red('Invalid key or network error. Please try again.'));
    }
  }
}

async function startBackend(key) {
  return new Promise((resolve, reject) => {
    const backendProcess = spawn('python', ['-m', 'uvicorn', 'main:app', '--port', '8000'], {
      cwd: path.join(projectRoot, 'backend'),
      env: { ...process.env, GROQ_API_KEY: key, PATH: process.env.PATH },
      stdio: ['ignore', 'ignore', 'pipe']
    });

    let backendError = '';
    backendProcess.stderr.on('data', (data) => {
      backendError += data.toString();
    });

    const spinner = ora('Starting backend...').start();
    
    let isHealthy = false;
    let attempts = 0;
    
    const checkHealth = async () => {
      if (isHealthy) return;
      attempts++;
      try {
        const res = await fetch('http://localhost:8000/health');
        if (res.status === 200) {
          isHealthy = true;
          spinner.succeed('Backend started successfully.');
          resolve(backendProcess);
        } else {
          throw new Error('Not ready');
        }
      } catch (err) {
        if (attempts > 30) {
          spinner.fail('Backend failed to start within 30 seconds.');
          if (backendError) {
            console.error(chalk.red('\nBackend Error Logs:\n'), chalk.yellow(backendError));
          }
          backendProcess.kill();
          process.exit(1);
        } else {
          setTimeout(checkHealth, 1000);
        }
      }
    };
    
    backendProcess.on('exit', (code) => {
      if (code !== 0 && !isHealthy) {
        spinner.fail(`Backend exited prematurely with code ${code}.`);
        if (backendError) {
          console.error(chalk.red('\nBackend Error Logs:\n'), chalk.yellow(backendError));
        }
        process.exit(1);
      }
    });

    checkHealth();
  });
}

async function checkHindsight() {
  const spinner = ora('Connecting to Hindsight...').start();
  try {
    const res = await fetch('http://localhost:8888');
    spinner.succeed('Connected to Hindsight.');
  } catch (err) {
    spinner.warn('Hindsight not reachable on port 8888. Continuing anyway.');
  }
}

function launchDashboard() {
  const screen = blessed.screen({ smartCSR: true, title: 'Obsidian Dashboard' });
  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  const line = grid.set(0, 0, 6, 12, contrib.line, {
    style: { line: "yellow", text: "green", baseline: "black" },
    xLabelPadding: 3,
    xPadding: 5,
    showLegend: true,
    wholeNumbersOnly: false,
    label: 'Query Latency (ms)'
  });
  
  const series1 = {
     title: 'support-bot',
     x: ['t1', 't2', 't3', 't4'],
     y: [120, 150, 130, 110]
  };
  line.setData([series1]);

  const log = grid.set(6, 0, 4, 12, contrib.log, { 
    fg: "green", 
    selectedFg: "green", 
    label: 'Audit Log'
  });
  
  log.log("Dashboard loaded.");
  log.log("Waiting for events...");

  const input = grid.set(10, 0, 2, 12, blessed.textbox, {
    label: ' Live Query Input (Press Enter to submit) ',
    inputOnFocus: true,
    keys: true,
    style: {
      fg: 'white',
      bg: 'black',
      border: { fg: '#f0f0f0' },
      focus: { border: { fg: 'green' } }
    }
  });

  input.on('submit', async (value) => {
    if (!value.trim()) {
      input.clearValue();
      input.focus();
      screen.render();
      return;
    }
    
    log.log(`> [Query] ${value}`);
    input.clearValue();
    screen.render();

    try {
      const res = await fetch('http://localhost:8000/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: value })
      });
      const data = await res.json();
      log.log(`< [Response] ${data.response}`);
    } catch (err) {
      log.log(`! [Error] ${err.message}`);
    }

    input.focus();
    screen.render();
  });

  screen.key(['escape', 'C-c'], function(ch, key) {
    return process.emit('SIGINT');
  });

  // Keep input focused
  input.focus();
  screen.render();
}

async function main() {
  let backendProcess = null;

  process.on('SIGINT', () => {
    if (backendProcess) {
      backendProcess.kill();
    }
    process.exit(0);
  });

  try {
    await showBanner();
    const key = await getAndValidateKey();
    backendProcess = await startBackend(key);
    await checkHindsight();
    
    // Clear the screen slightly before rendering blessed dashboard
    console.log(chalk.green('\nLaunching dashboard...'));
    setTimeout(() => {
      launchDashboard();
    }, 1000);
    
  } catch (err) {
    console.error(chalk.red('\nAn unexpected error occurred:'), err.message);
    if (backendProcess) backendProcess.kill();
    process.exit(1);
  }
}

main();
