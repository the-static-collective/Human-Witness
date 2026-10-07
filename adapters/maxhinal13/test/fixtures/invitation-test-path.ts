import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';

/** The original exact-byte image is user-provided, not a Git fixture.
 * Pass MX13_INVITATION_PATH to require it explicitly; when absent, only
 * image-dependent integration tests skip, while all security unit tests run.
 */
export const invitationTestPath=process.env.MX13_INVITATION_PATH ??
  join(dirname(fileURLToPath(import.meta.url)),'../../../../../1000018575.png');
export const invitationSkipReason=!process.env.MX13_INVITATION_PATH&&!existsSync(invitationTestPath)?
  'exact INVITATION bytes supplied externally; set MX13_INVITATION_PATH to enforce':false;
