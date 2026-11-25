import {isAbsolute} from 'node:path';
import {chromium} from 'playwright';

export function launchQaBrowser(options) {
  const executablePath = process.env.QA_CHROMIUM_EXECUTABLE;
  if (executablePath && !isAbsolute(executablePath)) {
    throw Error('QA_CHROMIUM_EXECUTABLE must be an absolute path');
  }
  return chromium.launch({...options, executablePath});
}
