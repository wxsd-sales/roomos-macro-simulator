import adjustRegular from "@momentum-design/icons/dist/svg/adjust-regular.svg?raw";
import airplayRegular from "@momentum-design/icons/dist/svg/airplay-regular.svg?raw";
import arrowTriangleDownFilled from "@momentum-design/icons/dist/svg/arrow-triangle-down-filled.svg?raw";
import calendarAddRegular from "@momentum-design/icons/dist/svg/calendar-add-regular.svg?raw";
import calendarEmptyRegular from "@momentum-design/icons/dist/svg/calendar-empty-regular.svg?raw";
import cameraRegular from "@momentum-design/icons/dist/svg/camera-filled.svg?raw";
import checkRegular from "@momentum-design/icons/dist/svg/check-regular.svg?raw";
import contentShareRegular from "@momentum-design/icons/dist/svg/content-share-regular.svg?raw";
import deviceConnectionRegular from "@momentum-design/icons/dist/svg/device-connection-regular.svg?raw";
import filesRegular from "@momentum-design/icons/dist/svg/files-regular.svg?raw";
import laptopRegular from "@momentum-design/icons/dist/svg/laptop-regular.svg?raw";
import saveRegular from "@momentum-design/icons/dist/svg/save-regular.svg?raw";
import speakerTurnDownRegular from "@momentum-design/icons/dist/svg/speaker-turn-down-regular.svg?raw";
import speakerTurnUpRegular from "@momentum-design/icons/dist/svg/speaker-turn-up-regular.svg?raw";
import toolsRegular from "@momentum-design/icons/dist/svg/tools-regular.svg?raw";
import webexTeamsRegular from "@momentum-design/icons/dist/svg/webex-teams-regular.svg?raw";
import whiteboardRegular from "@momentum-design/icons/dist/svg/whiteboard-regular.svg?raw";

const icons = {
  adjust: adjustRegular,
  airplay: airplayRegular,
  arrowTriangleDown: arrowTriangleDownFilled,
  calendarAdd: calendarAddRegular,
  calendarEmpty: calendarEmptyRegular,
  camera: cameraRegular,
  check: checkRegular,
  contentShare: contentShareRegular,
  deviceConnection: deviceConnectionRegular,
  files: filesRegular,
  laptop: laptopRegular,
  save: saveRegular,
  speakerTurnDown: speakerTurnDownRegular,
  speakerTurnUp: speakerTurnUpRegular,
  tools: toolsRegular,
  webexTeams: webexTeamsRegular,
  whiteboard: whiteboardRegular,
};

export function icon(name, className = "momentum-icon") {
  const markup = icons[name];
  if (!markup) {
    return "";
  }

  return `<span class="${className}" aria-hidden="true">${markup}</span>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-momentum-icon]").forEach((element) => {
    const markup = icons[element.dataset.momentumIcon];
    if (!markup) {
      return;
    }

    element.classList.add("momentum-icon");
    element.setAttribute("aria-hidden", "true");
    element.innerHTML = markup;
  });
}
