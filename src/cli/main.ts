import { APP_VERSION } from '../core/version';

const args = process.argv.slice(2);
if (args[0] === '--version' || args[0] === '-v') {
  console.log(APP_VERSION);
} else {
  console.log(`kimball ${APP_VERSION} — commands arrive with #13`);
}
