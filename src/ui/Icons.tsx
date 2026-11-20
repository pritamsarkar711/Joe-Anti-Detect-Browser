import {
  LayersRounded, PublicRounded, DevicesRounded, FingerprintRounded, TimelineRounded, SettingsRounded,
  AddRounded, SearchRounded, PlayArrowRounded, StopRounded, MoreHorizRounded, FileDownloadRounded,
  FileUploadRounded, ContentCopyRounded, DeleteRounded, EditRounded, CheckRounded, CloseRounded,
  MenuRounded, LightModeRounded, DarkModeRounded, RefreshRounded, ComputerRounded, PhoneAndroidRounded,
  LanguageRounded, ShieldRounded, ScienceRounded, OpenInNewRounded, KeyboardArrowDownRounded,
  KeyboardArrowRightRounded, TuneRounded, InfoRounded, WarningRounded, CheckCircleRounded, ErrorRounded,
  BoltRounded, GroupsRounded, TagRounded, NotesRounded, ExtensionRounded, CookieRounded, LinkRounded,
  CloudRounded, CloudOffRounded, SendRounded, FilterListRounded, SortRounded, ViewListRounded,
  GridViewRounded, TerminalRounded, ArrowForwardRounded, DnsRounded, SpeedRounded, StorageRounded,
  SyncRounded, FactCheckRounded, VerifiedUserRounded, BugReportRounded, WidgetsRounded, DashboardRounded,
  MenuOpenRounded, ChevronLeftRounded, MoreVertRounded, PersonRounded, StarRounded, FolderRounded,
  VpnKeyRounded, LockRounded, ScheduleRounded, BarChartRounded, AutoAwesomeRounded, BuildRounded,
  CodeRounded, MemoryRounded, MonitorRounded, WebRounded, EmojiFlagsRounded, RestartAltRounded,
  SaveRounded, VisibilityRounded, VisibilityOffRounded, LaunchRounded, CircleRounded,
  HistoryRounded, KeyboardRounded, PublicOffRounded, SwapHorizRounded, NotificationsActiveRounded,
  ContentPasteGoRounded, ShieldMoonRounded, BookmarkRounded, ShuffleRounded,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';

/** Google Material icons, sized slightly larger than the previous 16px set. */
const MAP: Record<string, SvgIconComponent> = {
  layers: LayersRounded, profiles: LayersRounded, globe: PublicRounded, proxies: PublicRounded,
  devices: DevicesRounded, fingerprints: FingerprintRounded, activity: TimelineRounded,
  settings: SettingsRounded, plus: AddRounded, search: SearchRounded, play: PlayArrowRounded,
  stop: StopRounded, more: MoreHorizRounded, download: FileDownloadRounded, upload: FileUploadRounded,
  copy: ContentCopyRounded, trash: DeleteRounded, edit: EditRounded, check: CheckRounded,
  close: CloseRounded, menu: MenuRounded, sun: LightModeRounded, moon: DarkModeRounded,
  refresh: RefreshRounded, computer: ComputerRounded, phone: PhoneAndroidRounded,
  language: LanguageRounded, shield: ShieldRounded, science: ScienceRounded, open: OpenInNewRounded,
  chevronDown: KeyboardArrowDownRounded, chevronRight: KeyboardArrowRightRounded, tune: TuneRounded,
  info: InfoRounded, warn: WarningRounded, warning: WarningRounded, alert: WarningRounded, ok: CheckCircleRounded, err: ErrorRounded,
  bolt: BoltRounded, groups: GroupsRounded, tag: TagRounded, notes: NotesRounded,
  extension: ExtensionRounded, cookie: CookieRounded, link: LinkRounded, cloud: CloudRounded,
  cloudOff: CloudOffRounded, send: SendRounded, filter: FilterListRounded, sort: SortRounded,
  list: ViewListRounded, grid: GridViewRounded, terminal: TerminalRounded, arrow: ArrowForwardRounded,
  dns: DnsRounded, speed: SpeedRounded, storage: StorageRounded, sync: SyncRounded,
  factcheck: FactCheckRounded, verified: VerifiedUserRounded, bug: BugReportRounded,
  widgets: WidgetsRounded, dashboard: DashboardRounded, panel: MenuOpenRounded,
  back: ChevronLeftRounded, vert: MoreVertRounded, person: PersonRounded, star: StarRounded,
  folder: FolderRounded, key: VpnKeyRounded, lock: LockRounded, clock: ScheduleRounded,
  chart: BarChartRounded, spark: AutoAwesomeRounded, build: BuildRounded, code: CodeRounded,
  cpu: MemoryRounded, monitor: MonitorRounded, web: WebRounded, flag: EmojiFlagsRounded,
  restart: RestartAltRounded, save: SaveRounded, visible: VisibilityRounded, hidden: VisibilityOffRounded,
  launch: LaunchRounded, circle: CircleRounded,
  history: HistoryRounded, keyboard: KeyboardRounded, globeOff: PublicOffRounded,
  swap: SwapHorizRounded, notify: NotificationsActiveRounded, paste: ContentPasteGoRounded,
  stealth: ShieldMoonRounded, bookmark: BookmarkRounded, shuffle: ShuffleRounded,
};

export type IconName = keyof typeof MAP | string;

export function Icon({ name, size = 22, className, color }: { name: IconName; size?: number; className?: string; color?: string }) {
  const C = MAP[name] ?? CircleRounded;
  return <C sx={{ fontSize: size, color, display: 'block' }} className={className} aria-hidden="true" />;
}
