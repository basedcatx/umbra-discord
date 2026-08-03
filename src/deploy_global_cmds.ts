import { readdirSync } from 'fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { REST, Routes } from 'discord.js';
import botConfigs from './config';
import { log } from './utils/logger';

const commands: object[] = [];
async function loadAllCommands(cmdDir: string, type: 'message' | 'interaction' | 'any') {
  const commandDirectory = readdirSync(pathToFileURL(cmdDir), { withFileTypes: true });

  for (const command of commandDirectory) {
    const fullPath = pathToFileURL(path.join(cmdDir, command.name));

    if (command.isDirectory()) {
      if (command.name.includes('interaction')) {
        await loadAllCommands(path.join(cmdDir, command.name), 'interaction');
        continue;
      }
      await loadAllCommands(path.join(cmdDir, command.name), 'message');
      continue;
    }

    const obj = await import(fullPath.href);
    const {
      default: { name, description, execute },
    } = obj;

    if (!name || !description || !execute) {
      log.error(
        `Sorry a command file found couldn't be loaded due to missing fields. Name: ${name}, desc: ${description}, exec: ${execute ? 'defined' : 'undefined'}`,
      );
      continue;
    }

    if (type === 'interaction') {
      commands.push(obj.default);
    }

    log.info(`Command: ${name} was loaded successfully! Type: ${type} commandDescription: ${description}`);
  }
}

await loadAllCommands(path.join(__dirname, 'commands'), 'any');
const rest = new REST().setToken(botConfigs.env.bot.token);

rest
  .put(Routes.applicationCommands(botConfigs.env.bot.clientId), {
    body: commands,
  })
  .then((_) => {
    log.info(['All commands successfully registered']);
  })
  .catch((err) => log.error(err));
