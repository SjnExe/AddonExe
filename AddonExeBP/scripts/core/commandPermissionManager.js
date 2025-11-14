import createConfigManager from './configManagerFactory.js';
import { commandPermissions as defaultPermissions } from '../commandPermissions.js';

const commandPermissionManager = createConfigManager('exe:cmdperms:current', defaultPermissions, 'CommandPermissions');

export const loadCommandPermissions = commandPermissionManager.load;
export const getCommandPermissions = commandPermissionManager.get;
export const updateCommandPermission = commandPermissionManager.update;
export const reloadCommandPermissions = commandPermissionManager.reload;
