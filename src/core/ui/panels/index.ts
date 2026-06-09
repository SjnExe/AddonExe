import { BountyPanelHandler } from '@features/economy/ui/bountyPanel.js';
import { EconomyPanelHandler } from '@features/economy/ui/panel.js';
import { WorldProtectionPanelHandler } from '@features/essentials/ui/worldProtectionPanel.js';
import { KitPanelHandler } from '@features/kit/ui/panel.js';
import { ModerationPanelHandler } from '@features/moderation/ui/panel.js';
import { XrayPanelHandler } from '@features/moderation/ui/xrayPanel.js';
import { ShopAdminPanelHandler } from '@features/shop/ui/adminPanel.js';
import { ShopUserPanelHandler } from '@features/shop/ui/userPanel.js';
import { FriendPanelHandler } from '@features/social/ui/friendPanel.js';
import { TeamPanelHandler } from '@features/team/ui/panel.js';
import { TeleportPanelHandler } from '@features/teleport/ui/panel.js';
import { panelRouter } from '@ui/PanelRouter.js';
import { SidebarPanelHandler } from '@ui/panels/sidebarPanel.js';
import { AdminPanelHandler } from './adminPanel.js';
import { ConfigPanelHandler } from './configPanel.js';
import { GeneralPanelHandler } from './generalPanel.js';
import { InfoPanelHandler } from './infoPanel.js';
import { PlayerPanelHandler } from './playerPanel.js';
import { RankPanelHandler } from './rankPanel.js';

export function initialize() {
    // Core Handlers
    panelRouter.register(new AdminPanelHandler());
    panelRouter.register(new ConfigPanelHandler());
    panelRouter.register(new GeneralPanelHandler());
    panelRouter.register(new InfoPanelHandler());
    panelRouter.register(new PlayerPanelHandler());
    panelRouter.register(new RankPanelHandler());
    panelRouter.register(new SidebarPanelHandler());

    // Feature Handlers
    panelRouter.register(new BountyPanelHandler());
    panelRouter.register(new EconomyPanelHandler());
    panelRouter.register(new KitPanelHandler());
    panelRouter.register(new ModerationPanelHandler());
    panelRouter.register(new XrayPanelHandler());
    panelRouter.register(new ShopAdminPanelHandler());
    panelRouter.register(new ShopUserPanelHandler());
    panelRouter.register(new FriendPanelHandler());
    panelRouter.register(new TeamPanelHandler());
    panelRouter.register(new TeleportPanelHandler());
    panelRouter.register(new WorldProtectionPanelHandler());
}
