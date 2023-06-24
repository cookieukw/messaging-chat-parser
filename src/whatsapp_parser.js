/** generated by ChatGPT **/

const fs = require('fs');
const path = require('path');

const USER_TAG = '[me]';
const OTHERS_TAG = '[others]';

const WA_STOP_WORDS = fs
  .readFileSync(path.join(__dirname, 'data/resources/WhatsApp_stopwords.txt'), 'utf-8')
  .split('\n')
  .map((word) => word.trim());

function parseLine(line, datetimeFormat) {
  let timestamp = null;
  let actor = 'invalid';
  let text = '';

  const lineElements = line.match(/(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}) - (\w+): (.+)/);
  if (lineElements) {
    const messageDatetime = lineElements[1];
    timestamp = new Date(messageDatetime);
    actor = lineElements[2];
    text = lineElements[3];
  }
  return [timestamp, actor, text];
}

function stopWordChecker(actor, invalidLines, text) {
  for (const stopWord of WA_STOP_WORDS) {
    if (text.includes(stopWord)) {
      invalidLines.push(`[STOP_WORD] ${actor} - ${text}`);
      return true;
    }
  }
  return false;
}

function saveText(textList, outputPath) {
  console.info(`Saving ${outputPath}`);
  fs.writeFileSync(outputPath, textList.join('\n'));
}

function parseChat(filePath, userName, datetimeFormat, deltaHThreshold, sessionToken) {
  const chatText = sessionToken ? [sessionToken] : [];
  const invalidLines = [];

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  let tLast = null;
  for (const line of lines) {
    const [tCurrent, actor, text] = parseLine(line, datetimeFormat);

    if (actor === 'invalid') {
      invalidLines.push(`${actor} - ${text}`);
      continue;
    }
    if (stopWordChecker(actor, invalidLines, text)) {
      continue;
    }

    splitInSessions(tCurrent, tLast, chatText, deltaHThreshold, sessionToken);
    tLast = tCurrent;

    const actorTag = actor === userName ? USER_TAG : OTHERS_TAG;
    chatText.push(`${actorTag} ${text}`);
  }

  console.info(`Found ${invalidLines.length} invalid lines in ${filePath}`);
  fs.writeFileSync(`./tmp/invalid_lines_${path.basename(filePath)}`, invalidLines.join('\n'));

  return chatText;
}

function splitInSessions(tCurrent, tLast, chatText, deltaHThreshold, sessionToken) {
  if (!tLast) {
    return;
  }

  const deltaHours = (tCurrent - tLast) / (1000 * 60 * 60);
  if (deltaHours >= deltaHThreshold) {
    chatText.push(sessionToken);
  }
}

function run(userName, chatsPath, outputPath, timeFormat, deltaHThreshold, sessionToken) {
  console.info(`WA_STOP_WORDS:${WA_STOP_WORDS}`);
  fs.mkdirSync('./tmp', { recursive: true });

  const txtFilesPaths = fs.readdirSync(chatsPath).filter((file) => file.endsWith('.txt'));
  console.info(`Found ${txtFilesPaths.length} txt files in '${chatsPath}' folder:`, txtFilesPaths);

  const waText = [];
  for (const file of txtFilesPaths) {
    const filePath = path.join(chatsPath, file);
    const fileTextParsed = parseChat(filePath, userName, timeFormat, deltaHThreshold, sessionToken);
    waText.push(...fileTextParsed);
  }

  const chatPath = path.join(outputPath, 'wa-chats.txt');
  saveText(waText, chatPath);
}

function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  const logLevel = options.verbose ? 'debug' : 'info';
  const processName = path.basename(process.argv[1]);
  console.info(`[${processName}][${logLevel}]: Starting...`);

  run(options.userName, options.chatsPath, options.outputPath, options.timeFormat, options.deltaHThreshold, options.sessionToken);

  console.info(`[${processName}][${logLevel}]: Finished.`);
}

function parseArgs(args) {
  const options = {
    userName: '',
    chatsPath: './data/chat_raw/whatsapp/',
    outputPath: './data/chat_parsed/',
    sessionToken: null,
    deltaHThreshold: 4,
    timeFormat: '%d/%m/%y %H:%M',
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--user_name':
        options.userName = args[i + 1];
        break;
      case '--chats_path':
        options.chatsPath = args[i + 1];
        break;
      case '--output_path':
        options.outputPath = args[i + 1];
        break;
      case '--session_token':
        options.sessionToken = args[i + 1];
        break;
      case '--delta_h_threshold':
        options.deltaHThreshold = parseInt(args[i + 1]);
        break;
      case '--time_format':
        options.timeFormat = args[i + 1];
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
    }
  }

  return options;
}

main();
