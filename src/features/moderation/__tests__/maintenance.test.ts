import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { Player } from '@core/__tests__/__mocks__/minecraftMock.js';
import * as permissionEngine from '@core/permissions/permissionEngine.js';
import * as playerUtils from '@core/utils/player.js';
import {
  _resetMaintenanceForTest,
  addMaintenanceWhitelist,
  enforceMaintenanceOnJoin,
  getMaintenanceState,
  isPlayerAllowedInMaintenance,
  removeMaintenanceWhitelist,
  setMaintenanceEnabled,
} from '@features/moderation/maintenanceManager.js';

describe('Maintenance Mode & Whitelist', () => {
  beforeEach(() => {
    _resetMaintenanceForTest();
  });

  afterEach(() => {
    _resetMaintenanceForTest();
  });

  it('blocks non-whitelisted regular players and allows whitelisted or staff players', () => {
    const permSpy = spyOn(permissionEngine, 'hasPermission').mockImplementation((p: any, node: string) => {
      return p.name === 'StaffUser' && node === 'group.mod';
    });
    const kickSpy = spyOn(playerUtils, 'kickPlayer').mockReturnValue(true);

    const regular = new Player('r1', 'RegularUser');
    const staff = new Player('s1', 'StaffUser');

    expect(isPlayerAllowedInMaintenance(regular as any)).toBe(true);

    setMaintenanceEnabled(true, 'Updating server');
    expect(getMaintenanceState().enabled).toBe(true);
    expect(isPlayerAllowedInMaintenance(regular as any)).toBe(false);
    expect(isPlayerAllowedInMaintenance(staff as any)).toBe(true);
    expect(enforceMaintenanceOnJoin(regular as any)).toBe(true);
    expect(kickSpy).toHaveBeenCalledTimes(1);
    expect(kickSpy).toHaveBeenCalledWith('RegularUser', 'Updating server');

    expect(addMaintenanceWhitelist('RegularUser')).toBe(true);
    expect(isPlayerAllowedInMaintenance(regular as any)).toBe(true);
    expect(removeMaintenanceWhitelist('RegularUser')).toBe(true);
    expect(isPlayerAllowedInMaintenance(regular as any)).toBe(false);

    permSpy.mockRestore();
    kickSpy.mockRestore();
  });
});
