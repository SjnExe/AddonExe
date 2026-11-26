import type { CommandModule } from '@core/commands/commandManager.js';

import cmdFriend from '../friends/commands/friend.js';
import cmdMail from '../mail/commands/mail.js';
import cmdMsg from '../pm/commands/msg.js';
import cmdTeam from '../team/commands/team.js';
import cmdVote from '../vote/commands/vote.js';
import cmdIgnore from './ignore.js';
import cmdNick from './nick.js';

/** Social domain slash commands. */
export const socialCommands: CommandModule[] = [cmdFriend, cmdIgnore, cmdMail, cmdMsg, cmdNick, cmdTeam, cmdVote];
