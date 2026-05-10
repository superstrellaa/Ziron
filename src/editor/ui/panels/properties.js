import { t } from "../../../engine/i18n/i18n.js";
import {
  SetActiveCommand,
  RenameCommand,
  GenericCommand,
  MultiRenameCommand,
  MultiSetActiveCommand,
} from "../../../engine/history/commands.js";

export function createProperties(container, selection, sceneManager, history) {
  const panel = document.createElement("div");
  panel.id = "properties";

  panel.innerHTML = `
    <div id="properties-header">
      <span id="properties-title">${t("properties.header")}</span>
    </div>
    <div id="properties-body">
      <div id="properties-empty">${t("properties.empty")}</div>
    </div>
  `;

  container.appendChild(panel);

  const body = panel.querySelector("#properties-body");
  let _currentEntity = null;
  let _currentMulti = [];
  let _rafId = null;
  let _unsubUpdate = null;

  function fmt(v) {
    return parseFloat(v.toFixed(3));
  }
  function deg(r) {
    return r * (180 / Math.PI);
  }
  function rad(d) {
    return d * (Math.PI / 180);
  }

  function mixed(entities, getValue) {
    const first = getValue(entities[0]);
    return entities.every((e) => fmt(getValue(e)) === fmt(first))
      ? first
      : null;
  }

  function mixedExact(entities, getValue) {
    const first = getValue(entities[0]);
    return entities.every((e) => getValue(e) === first) ? first : null;
  }

  function bindTransformInput(inputEl, setValueFns) {
    let _valuesOnFocus = null;

    inputEl.removeAttribute("readonly");

    inputEl.addEventListener("focus", () => {
      _valuesOnFocus = setValueFns.map((fn) => fn.get());
      if (inputEl.dataset.mixed !== "true") inputEl.select();
      else {
        inputEl.value = "";
        inputEl.dataset.mixed = "false";
      }
    });

    inputEl.addEventListener("input", () => {
      const v = parseFloat(inputEl.value);
      if (!isNaN(v)) setValueFns.forEach((fn) => fn.set(v));
    });

    function commit() {
      const v = parseFloat(inputEl.value);
      if (isNaN(v) || _valuesOnFocus === null) {
        restoreDisplay();
        return;
      }
      const changed = _valuesOnFocus.some((from) => fmt(from) !== fmt(v));
      if (changed) {
        const froms = _valuesOnFocus;
        history().push(
          GenericCommand(
            "TransformInput",
            () => setValueFns.forEach((fn) => fn.set(v)),
            () => setValueFns.forEach((fn, i) => fn.set(froms[i])),
          ),
        );
      }
      _valuesOnFocus = null;
    }

    function cancel() {
      if (_valuesOnFocus !== null) {
        setValueFns.forEach((fn, i) => fn.set(_valuesOnFocus[i]));
        _valuesOnFocus = null;
      }
      restoreDisplay();
      inputEl.blur();
    }

    function restoreDisplay() {
      const vals = setValueFns.map((fn) => fn.get());
      const allSame = vals.every((x) => fmt(x) === fmt(vals[0]));
      if (allSame) {
        inputEl.type = "number";
        inputEl.value = fmt(vals[0]);
        inputEl.dataset.mixed = "false";
      } else {
        inputEl.type = "text";
        inputEl.value = "—";
        inputEl.dataset.mixed = "true";
      }
    }

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
        inputEl.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    });
    inputEl.addEventListener("blur", () => commit());
  }

  function buildContent(entities) {
    const isSingle = entities.length === 1;
    const entity = isSingle ? entities[0] : null;

    const allActive = entities.every((e) => e.active !== false);
    const someActive = entities.some((e) => e.active !== false);
    const activeMixed = !allActive && someActive;

    const sharedName = mixedExact(entities, (e) => e.name);

    body.innerHTML = `
      <div class="prop-name-row">
        <div class="prop-name-header">
          <label class="prop-label">${t("properties.name")}</label>
          <label class="prop-active-label" data-tooltip="${t("properties.activeTip")}">
            <input type="checkbox" id="prop-active" ${allActive ? "checked" : ""} />
            <span>${t("properties.active")}</span>
          </label>
        </div>
        <input
          class="prop-input prop-name-input"
          id="prop-name"
          type="text"
          value="${sharedName ?? ""}"
          placeholder="${sharedName === null ? "—" : ""}"
          spellcheck="false"
          autocomplete="off"
          data-tooltip="${t("properties.nameTip")}"
        />
      </div>

      <div class="prop-section-label">${t("properties.position")}</div>
      <div class="prop-grid">
        <div class="prop-field"><span class="prop-axis prop-axis-x">X</span><input class="prop-input" id="prop-px" type="number" step="0.1" /></div>
        <div class="prop-field"><span class="prop-axis prop-axis-y">Y</span><input class="prop-input" id="prop-py" type="number" step="0.1" /></div>
        <div class="prop-field"><span class="prop-axis prop-axis-z">Z</span><input class="prop-input" id="prop-pz" type="number" step="0.1" /></div>
      </div>

      <div class="prop-section-label">${t("properties.rotation")}</div>
      <div class="prop-grid">
        <div class="prop-field"><span class="prop-axis prop-axis-x">X</span><input class="prop-input" id="prop-rx" type="number" step="1" /></div>
        <div class="prop-field"><span class="prop-axis prop-axis-y">Y</span><input class="prop-input" id="prop-ry" type="number" step="1" /></div>
        <div class="prop-field"><span class="prop-axis prop-axis-z">Z</span><input class="prop-input" id="prop-rz" type="number" step="1" /></div>
      </div>

      <div class="prop-section-label">${t("properties.scale")}</div>
      <div class="prop-grid">
        <div class="prop-field"><span class="prop-axis prop-axis-x">X</span><input class="prop-input" id="prop-sx" type="number" step="0.1" /></div>
        <div class="prop-field"><span class="prop-axis prop-axis-y">Y</span><input class="prop-input" id="prop-sy" type="number" step="0.1" /></div>
        <div class="prop-field"><span class="prop-axis prop-axis-z">Z</span><input class="prop-input" id="prop-sz" type="number" step="0.1" /></div>
      </div>
    `;

    const checkbox = body.querySelector("#prop-active");
    if (activeMixed) checkbox.indeterminate = true;

    function syncCheckbox() {
      const allActive = entities.every((e) => e.active !== false);
      const someActive = entities.some((e) => e.active !== false);
      checkbox.checked = allActive;
      checkbox.indeterminate = !allActive && someActive;
    }

    const unsubUpdate = (entity) => {
      if (entities.some((e) => e.id === entity.id)) syncCheckbox();
    };
    sceneManager.on("onUpdate", unsubUpdate);

    checkbox.addEventListener("change", () => {
      const newValue = checkbox.checked;
      checkbox.indeterminate = false;
      const cmd = MultiSetActiveCommand(sceneManager, entities, newValue);
      cmd.execute();
      history().push(cmd);
    });

    const nameInput = body.querySelector("#prop-name");
    nameInput.addEventListener("focus", () => nameInput.select());

    function resolveName(template, index) {
      return template.replace(/\{id\}/g, index + 1);
    }

    function commitName() {
      const newName = nameInput.value.trim();
      if (!newName) {
        nameInput.value = sharedName ?? "";
        nameInput.blur();
        return;
      }

      const hasTemplate = newName.includes("{id}");
      const toRename = entities.filter(
        (e, i) => e.name !== (hasTemplate ? resolveName(newName, i) : newName),
      );

      if (toRename.length > 0) {
        const resolved = toRename.map((e, i) => ({
          entity: e,
          name: hasTemplate
            ? resolveName(newName, entities.indexOf(e))
            : newName,
        }));
        const cmd = MultiRenameCommand(
          sceneManager,
          resolved.map((r) => r.entity),
          null,
          resolved,
        );
        cmd.execute();
        history().push(cmd);
      }
      nameInput.blur();
    }

    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitName();
      } else if (e.key === "Escape") {
        nameInput.value = sharedName ?? "";
        nameInput.blur();
      }
    });
    nameInput.addEventListener("blur", () => {
      const newName = nameInput.value.trim();
      if (!newName) {
        nameInput.value = sharedName ?? "";
        return;
      }

      const hasTemplate = newName.includes("{id}");
      const toRename = entities.filter(
        (e, i) => e.name !== (hasTemplate ? resolveName(newName, i) : newName),
      );

      if (toRename.length > 0) {
        const resolved = hasTemplate
          ? toRename.map((e) => ({
              entity: e,
              name: resolveName(newName, entities.indexOf(e)),
            }))
          : null;
        const cmd = MultiRenameCommand(
          sceneManager,
          toRename,
          newName,
          resolved,
        );
        cmd.execute();
        history().push(cmd);
      }
    });

    syncValues(entities);

    function axisBindings(getVal, setVal) {
      return entities.map((e) => ({
        get: () => getVal(e),
        set: (v) => setVal(e, v),
      }));
    }

    bindTransformInput(
      body.querySelector("#prop-px"),
      axisBindings(
        (e) => e.mesh.position.x,
        (e, v) => {
          e.mesh.position.x = v;
        },
      ),
    );
    bindTransformInput(
      body.querySelector("#prop-py"),
      axisBindings(
        (e) => e.mesh.position.y,
        (e, v) => {
          e.mesh.position.y = v;
        },
      ),
    );
    bindTransformInput(
      body.querySelector("#prop-pz"),
      axisBindings(
        (e) => e.mesh.position.z,
        (e, v) => {
          e.mesh.position.z = v;
        },
      ),
    );

    bindTransformInput(
      body.querySelector("#prop-rx"),
      axisBindings(
        (e) => deg(e.mesh.rotation.x),
        (e, v) => {
          e.mesh.rotation.x = rad(v);
        },
      ),
    );
    bindTransformInput(
      body.querySelector("#prop-ry"),
      axisBindings(
        (e) => deg(e.mesh.rotation.y),
        (e, v) => {
          e.mesh.rotation.y = rad(v);
        },
      ),
    );
    bindTransformInput(
      body.querySelector("#prop-rz"),
      axisBindings(
        (e) => deg(e.mesh.rotation.z),
        (e, v) => {
          e.mesh.rotation.z = rad(v);
        },
      ),
    );

    bindTransformInput(
      body.querySelector("#prop-sx"),
      axisBindings(
        (e) => e.mesh.scale.x,
        (e, v) => {
          e.mesh.scale.x = v;
        },
      ),
    );
    bindTransformInput(
      body.querySelector("#prop-sy"),
      axisBindings(
        (e) => e.mesh.scale.y,
        (e, v) => {
          e.mesh.scale.y = v;
        },
      ),
    );
    bindTransformInput(
      body.querySelector("#prop-sz"),
      axisBindings(
        (e) => e.mesh.scale.z,
        (e, v) => {
          e.mesh.scale.z = v;
        },
      ),
    );

    startLoop(entities);

    _unsubUpdate = sceneManager.on("onUpdate", unsubUpdate);
  }

  let _inputs = null;
  function getInputs() {
    if (_inputs) return _inputs;
    _inputs = {
      name: body.querySelector("#prop-name"),
      px: body.querySelector("#prop-px"),
      py: body.querySelector("#prop-py"),
      pz: body.querySelector("#prop-pz"),
      rx: body.querySelector("#prop-rx"),
      ry: body.querySelector("#prop-ry"),
      rz: body.querySelector("#prop-rz"),
      sx: body.querySelector("#prop-sx"),
      sy: body.querySelector("#prop-sy"),
      sz: body.querySelector("#prop-sz"),
    };
    return _inputs;
  }

  function syncValues(entities) {
    const inp = getInputs();
    if (!inp.px) return;

    const sharedName = mixedExact(entities, (e) => e.name);
    inp.name.value = sharedName ?? "";
    inp.name.placeholder = sharedName === null ? "—" : "";

    function setOrMixed(el, vals) {
      const allSame = vals.every((v) => fmt(v) === fmt(vals[0]));
      if (allSame) {
        el.value = fmt(vals[0]);
        el.dataset.mixed = "false";
      } else {
        el.value = "—";
        el.dataset.mixed = "true";
        el.removeAttribute("type");
        el.setAttribute("type", "text");
      }
    }

    function setField(el, vals) {
      const allSame = vals.every((v) => fmt(v) === fmt(vals[0]));
      if (allSame) {
        el.type = "number";
        el.value = fmt(vals[0]);
        el.dataset.mixed = "false";
      } else {
        el.type = "text";
        el.value = "—";
        el.dataset.mixed = "true";
      }
    }

    setField(
      inp.px,
      entities.map((e) => e.mesh.position.x),
    );
    setField(
      inp.py,
      entities.map((e) => e.mesh.position.y),
    );
    setField(
      inp.pz,
      entities.map((e) => e.mesh.position.z),
    );
    setField(
      inp.rx,
      entities.map((e) => deg(e.mesh.rotation.x)),
    );
    setField(
      inp.ry,
      entities.map((e) => deg(e.mesh.rotation.y)),
    );
    setField(
      inp.rz,
      entities.map((e) => deg(e.mesh.rotation.z)),
    );
    setField(
      inp.sx,
      entities.map((e) => e.mesh.scale.x),
    );
    setField(
      inp.sy,
      entities.map((e) => e.mesh.scale.y),
    );
    setField(
      inp.sz,
      entities.map((e) => e.mesh.scale.z),
    );
  }

  let _prev = {};

  function startLoop(entities) {
    stopLoop();
    _prev = {};

    function tick() {
      if (!_currentEntity && _currentMulti.length === 0) return;

      const inp = getInputs();
      if (!inp.px) return;

      function tickField(key, vals) {
        if (document.activeElement === inp[key]) return;
        const allSame = vals.every((v) => fmt(v) === fmt(vals[0]));
        if (allSame) {
          const next = fmt(vals[0]);
          if (_prev[key] !== next) {
            inp[key].type = "number";
            inp[key].value = next;
            inp[key].dataset.mixed = "false";
            _prev[key] = next;
          }
        } else {
          if (_prev[key] !== "—") {
            inp[key].type = "text";
            inp[key].value = "—";
            inp[key].dataset.mixed = "true";
            _prev[key] = "—";
          }
        }
      }

      if (document.activeElement !== inp.name) {
        const sharedName = mixedExact(entities, (e) => e.name);
        const nameVal = sharedName ?? "—";
        if (_prev.name !== nameVal) {
          inp.name.value = sharedName ?? "";
          inp.name.placeholder = sharedName === null ? "—" : "";
          _prev.name = nameVal;
        }
      }

      tickField(
        "px",
        entities.map((e) => e.mesh.position.x),
      );
      tickField(
        "py",
        entities.map((e) => e.mesh.position.y),
      );
      tickField(
        "pz",
        entities.map((e) => e.mesh.position.z),
      );
      tickField(
        "rx",
        entities.map((e) => deg(e.mesh.rotation.x)),
      );
      tickField(
        "ry",
        entities.map((e) => deg(e.mesh.rotation.y)),
      );
      tickField(
        "rz",
        entities.map((e) => deg(e.mesh.rotation.z)),
      );
      tickField(
        "sx",
        entities.map((e) => e.mesh.scale.x),
      );
      tickField(
        "sy",
        entities.map((e) => e.mesh.scale.y),
      );
      tickField(
        "sz",
        entities.map((e) => e.mesh.scale.z),
      );

      _rafId = requestAnimationFrame(tick);
    }

    _rafId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
    if (_unsubUpdate) {
      _unsubUpdate();
      _unsubUpdate = null;
    }
    _inputs = null;
  }

  function showEmpty() {
    stopLoop();
    _currentEntity = null;
    _currentMulti = [];
    body.innerHTML = `<div id="properties-empty">${t("properties.empty")}</div>`;
  }

  function refresh(single, multi) {
    if (!single && (!multi || multi.length === 0)) {
      showEmpty();
      return;
    }

    const entities = single ? [single] : multi;
    _currentEntity = single ?? null;
    _currentMulti = multi ?? [];
    buildContent(entities);
  }

  selection.onChange((single, multi) => {
    const entities = multi?.length > 0 ? multi : single ? null : null;
    if (!single && (!multi || multi.length === 0)) {
      showEmpty();
      return;
    }
    refresh(single, multi?.length > 0 ? multi : []);
  });

  return { refresh };
}
