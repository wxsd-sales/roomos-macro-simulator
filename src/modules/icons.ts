import adjustRegular from "@momentum-design/icons/dist/svg/adjust-regular.svg?raw";
import airplayRegular from "@momentum-design/icons/dist/svg/airplay-regular.svg?raw";
import arrowTriangleDownFilled from "@momentum-design/icons/dist/svg/arrow-triangle-down-filled.svg?raw";
import brightnessHighFilled from "@momentum-design/icons/dist/svg/brightness-high-filled.svg?raw";
import calendarAddRegular from "@momentum-design/icons/dist/svg/calendar-add-regular.svg?raw";
import calendarEmptyRegular from "@momentum-design/icons/dist/svg/calendar-empty-regular.svg?raw";
import cameraRegular from "@momentum-design/icons/dist/svg/camera-filled.svg?raw";
import checkRegular from "@momentum-design/icons/dist/svg/check-regular.svg?raw";
import contentShareRegular from "@momentum-design/icons/dist/svg/content-share-regular.svg?raw";
import deviceConnectionRegular from "@momentum-design/icons/dist/svg/device-connection-regular.svg?raw";
import filesRegular from "@momentum-design/icons/dist/svg/files-regular.svg?raw";
import laptopRegular from "@momentum-design/icons/dist/svg/laptop-regular.svg?raw";
import launchFilled from "@momentum-design/icons/dist/svg/launch-filled.svg?raw";
import listMenuRegular from "@momentum-design/icons/dist/svg/list-menu-regular.svg?raw";
import quietHoursPresenceFilled from "@momentum-design/icons/dist/svg/quiet-hours-presence-filled.svg?raw";
import saveRegular from "@momentum-design/icons/dist/svg/save-regular.svg?raw";
import speakerTurnDownRegular from "@momentum-design/icons/dist/svg/speaker-turn-down-regular.svg?raw";
import speakerTurnUpRegular from "@momentum-design/icons/dist/svg/speaker-turn-up-regular.svg?raw";
import toolsRegular from "@momentum-design/icons/dist/svg/tools-regular.svg?raw";
import webexTeamsRegular from "@momentum-design/icons/dist/svg/webex-teams-regular.svg?raw";
import whiteboardRegular from "@momentum-design/icons/dist/svg/whiteboard-regular.svg?raw";
import adjustHorizontalRegular from "@momentum-design/icons/dist/svg/adjust-horizontal-regular.svg?raw";
import roomLightsRegular from "@momentum-design/icons/dist/svg/room-lights-regular.svg?raw";
import playRegular from "@momentum-design/icons/dist/svg/play-regular.svg?raw";
import priorityCircleRegular from "@momentum-design/icons/dist/svg/priority-circle-regular.svg?raw";


const icons = {
  adjust: adjustRegular,
  airplay: airplayRegular,
  arrowTriangleDown: arrowTriangleDownFilled,
  brightnessHigh: brightnessHighFilled,
  calendarAdd: calendarAddRegular,
  calendarEmpty: calendarEmptyRegular,
  camera: cameraRegular,
  check: checkRegular,
  contentShare: contentShareRegular,
  deviceConnection: deviceConnectionRegular,
  files: filesRegular,
  laptop: laptopRegular,
  launch: launchFilled,
  listMenu: listMenuRegular,
  quietHoursPresence: quietHoursPresenceFilled,
  save: saveRegular,
  speakerTurnDown: speakerTurnDownRegular,
  speakerTurnUp: speakerTurnUpRegular,
  tools: toolsRegular,
  webexTeams: webexTeamsRegular,
  whiteboard: whiteboardRegular,
  blinds: adjustHorizontalRegular,
  lightbulb: roomLightsRegular,
  play: playRegular,
  priorityCircle: priorityCircleRegular,
} as const satisfies Record<string, string>;

export type IconName = keyof typeof icons;

function isIconName(name: string | undefined): name is IconName {
  return Boolean(name && name in icons);
}

export function icon(name: IconName | string, className = "momentum-icon"): string {
  if (!isIconName(name)) {
    return "";
  }

  const markup = icons[name];

  return `<span class="${className}" aria-hidden="true">${markup}</span>`;
}

export function hydrateIcons(root: ParentNode = document): void {
  root.querySelectorAll("[data-momentum-icon]").forEach((element) => {
    if (!(element instanceof HTMLElement) || !isIconName(element.dataset.momentumIcon)) {
      return;
    }

    const markup = icons[element.dataset.momentumIcon];
    element.classList.add("momentum-icon");
    element.setAttribute("aria-hidden", "true");
    element.innerHTML = markup;
  });
}
