function createCommandProxy(pathParts, executor) {
  return new Proxy(() => {}, {
    get(_, property) {
      return createCommandProxy([...pathParts, property], executor);
    },
    apply(_, __, args) {
      const path = pathParts.join(".");
      return executor(path, args[0] ?? {});
    },
  });
}

function createEventProxy(pathParts, register) {
  return new Proxy(
    {},
    {
      get(_, property) {
        if (property === "on") {
          return (callback) => register(pathParts.join("."), callback);
        }
        return createEventProxy([...pathParts, property], register);
      },
    },
  );
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return min;
  }
  return Math.max(min, Math.min(max, numeric));
}

export function createXapiFacade({ device, addLog, renderDevice }) {
  const eventHandlers = new Map();

  function register(path, callback) {
    if (!eventHandlers.has(path)) {
      eventHandlers.set(path, []);
    }
    eventHandlers.get(path).push(callback);
    addLog(`Registered handler for ${path}`, "success");
  }

  function emit(path, payload) {
    const handlers = eventHandlers.get(path) ?? [];
    handlers.forEach((handler) => handler(payload));
  }

  function commandExecutor(path, payload = {}) {
    addLog(`xapi.Command.${path}(${JSON.stringify(payload)})`);

    switch (path) {
      case "UserInterface.Message.Alert.Display":
        device.alert = {
          title: payload.Title ?? "Untitled alert",
          text: payload.Text ?? "No message supplied.",
        };
        break;
      case "UserInterface.Message.Alert.Clear":
        device.alert = null;
        break;
      case "UserInterface.Extensions.Panel.Save": {
        const id = payload.PanelId ?? `panel-${device.panels.length + 1}`;
        const existing = device.panels.find((panel) => panel.id === id);
        const nextPanel = {
          id,
          name: payload.Name ?? payload.PanelId ?? "Custom Panel",
          activityType: payload.ActivityType ?? "Custom",
        };
        if (existing) {
          existing.name = nextPanel.name;
          existing.activityType = nextPanel.activityType;
        } else {
          device.panels.push(nextPanel);
        }
        break;
      }
      case "UserInterface.Extensions.Panel.Open":
        device.activePanel = payload.PanelId ?? "Unknown";
        addLog(`Opened panel ${device.activePanel}`, "success");
        break;
      case "RoomScheduler.Configure":
        device.scheduler = {
          busy: Boolean(payload.Busy),
          title: payload.Title ?? device.scheduler.title,
          subtitle: payload.Subtitle ?? device.scheduler.subtitle,
          nextMeeting: payload.NextMeeting ?? device.scheduler.nextMeeting,
          presenter: payload.Presenter ?? device.scheduler.presenter,
          progress: clampNumber(payload.Progress, 0, 100),
        };
        break;
      default:
        addLog(`No simulation mapping yet for xapi.Command.${path}`, "error");
    }

    renderDevice();
    return Promise.resolve({ ok: true });
  }

  function statusGet(path) {
    addLog(`xapi.Status.get(${path})`);
    if (path === "UserInterface.Extensions.ActivePanel") {
      return Promise.resolve(device.activePanel);
    }
    if (path === "RoomScheduler.State") {
      return Promise.resolve(device.scheduler);
    }
    return Promise.resolve(null);
  }

  return {
    Command: createCommandProxy([], commandExecutor),
    Event: createEventProxy([], register),
    Status: { get: statusGet },
    command: (path, payload) => commandExecutor(path, payload),
    emit,
  };
}
