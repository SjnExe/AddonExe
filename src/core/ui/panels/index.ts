import { BountyPanelHandler } from '@features/economy/ui/bountyPanel.js';
import { EconomyPanelHandler } from '@features/economy/ui/economyPanel.js';
import { GamesPanelHandler } from '@features/games/ui/gamesPanel.js';
import { KitPanelHandler } from '@features/kits/ui/kitPanel.js';
import { ModerationPanelHandler } from '@features/moderation/ui/moderationPanel.js';
import { XrayPanelHandler } from '@features/moderation/ui/xrayPanel.js';
import { ShopPanelHandler } from '@features/shop/ui/shopPanel.js';
import { FriendPanelHandler } from '@features/social/ui/friendPanel.js';
import { TeamPanelHandler } from '@features/teams/ui/teamPanel.js';
import { TeleportPanelHandler } from '@features/teleportation/ui/teleportPanel.js';
import { panelRouter } from '@ui/PanelRouter.js';
import { AdminPanelHandler } from './adminPanel.js';
import { CommandPanelHandler } from './commandPanel.js';
import { ConfigPanelHandler } from './configPanel.js';
import { GeneralPanelHandler } from './generalPanel.js';
import { InfoPanelHandler } from './infoPanel.js';
import { PlayerPanelHandler } from './playerPanel.js';
import { RankPanelHandler } from './rankPanel.js';
import { SidebarPanelHandler } from './sidebarPanel.js';

export function initialize() {
    // Core Handlers
    panelRouter.register(new AdminPanelHandler());
    panelRouter.register(new CommandPanelHandler());
    panelRouter.register(new ConfigPanelHandler());
    panelRouter.register(new GeneralPanelHandler());
    panelRouter.register(new InfoPanelHandler());
    panelRouter.register(new PlayerPanelHandler());
    panelRouter.register(new RankPanelHandler());
    panelRouter.register(new SidebarPanelHandler());

    // Feature Handlers
    panelRouter.register(new BountyPanelHandler());
    panelRouter.register(new EconomyPanelHandler());
    panelRouter.register(new GamesPanelHandler());
    panelRouter.register(new KitPanelHandler());
    panelRouter.register(new ModerationPanelHandler());
    panelRouter.register(new XrayPanelHandler());
    panelRouter.register(new ShopPanelHandler());
    panelRouter.register(new FriendPanelHandler());
    panelRouter.register(new TeamPanelHandler());
    panelRouter.register(new TeleportPanelHandler());
}
