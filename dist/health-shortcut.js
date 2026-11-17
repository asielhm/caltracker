import { currentLanguage } from "./i18n.js";
export function openHealthSetup({ modal, toast }) {
  modal(
    "Connect Apple Health",
    `
    <p>Safari cannot read Apple Health directly. Your personal iPhone Shortcut sends only daily steps and active calories to this diary.</p>
    <p class="notice">Cloud diary saving must work first. Use the same website on your PC and iPhone. Run the Shortcut again to update today’s totals; imports replace totals rather than add to them.</p>
    <button class="solid full" id="health-token-create">Create my private connection token</button>
    <p id="health-setup-status" role="status"></p>
    <div id="health-credentials" hidden><label class="field">Shortcut URL<input id="health-url" readonly></label><button class="textbtn" id="health-copy-url">Copy URL</button><label class="field">Private token · expires in 90 days<input id="health-token" type="password" readonly autocomplete="off"></label><button class="textbtn" id="health-copy-token">Copy token</button><p>Keep this token private. It can update steps and active calories, but cannot read your diary or log meals. Changing your app password revokes all connection tokens.</p></div>
    <details class="shortcut-guide" open><summary>Build the Shortcut on your iPhone</summary>
    <ol>
      <li>Open <b>Shortcuts → +</b>. Name it <b>Sync NutriAR Health</b>. Add <b>Current Date</b> and <b>Format Date</b>, using custom format <b>yyyy-MM-dd</b>. The diary uses Buenos Aires dates; use that timezone on your iPhone when running this Shortcut.</li>
      <li>Add <b>Find Health Samples</b>: type <b>Steps</b>, start date <b>today</b>, no result limit. Restrict to one data source/device (your iPhone or Apple Watch). Extract the sample <b>Value</b> with <b>Get Details of Health Samples</b>, then <b>Calculate Statistics → Sum</b>. Save that result as variable <b>DailySteps</b>.</li>
      <li>Repeat for <b>Active Energy</b>, from one source (usually Apple Watch), in <b>kcal</b>, for <b>today</b>. Save the sum as <b>DailyActiveKcal</b>. Use active energy only, excluding resting/basal energy. Do not add calorie estimates for steps.</li>
      <li>If either search returns no samples, stop and check Health permissions/data instead of sending a made-up zero. On first run, allow Shortcuts to read these two Health types. A zero is valid only if it is an actual recorded value.</li>
      <li>Add <b>Get Contents of URL</b> using the copied URL. Set method <b>POST</b>. Add headers <b>Authorization</b> = <b>Bearer </b> followed by the copied token, and <b>Content-Type</b> = <b>application/json</b>. Set Request Body to <b>JSON</b> with three fields: <b>date</b> (Text: formatted date), <b>steps</b> (Number: DailySteps), <b>activeKcal</b> (Number: DailyActiveKcal).</li>
      <li>Add <b>Show Result</b> for the response. Run it: the response must include <b>ok: true</b>. Then return here, close this guide, and select <b>Sync now</b>.</li>
      <li>Optional: in <b>Shortcuts → Automation → Time of Day</b>, run this Shortcut every evening. Select <b>Run Immediately</b> where supported. iOS may still require permission, an unlocked phone or manual execution.</li>
    </ol><p class="notice">Health action labels vary by iOS version. Summing overlapping iPhone and Watch records can double-count steps: use one source per metric. The result can differ from Apple Health’s merged total. This website cannot create an Apple-signed Shortcut for you; the setup above is done on your phone.</p></details>
    <button class="textbtn" id="health-check">Check last received import</button><p id="health-check-result" role="status"></p>
  `,
  );
  if (currentLanguage() === "es")
    document.querySelector(".shortcut-guide").innerHTML = `
    <summary>Armá el Atajo en tu iPhone</summary><ol>
    <li>Abrí <b>Atajos → +</b> y llamalo <b>Sincronizar Salud con NutriAR</b>. Agregá <b>Fecha actual</b> y <b>Formatear fecha</b>, con formato personalizado <b>yyyy-MM-dd</b>. El diario usa la fecha de Buenos Aires; usá esa zona horaria en el iPhone.</li>
    <li>Agregá <b>Buscar muestras de Salud</b>: tipo <b>Pasos</b>, fecha de inicio <b>hoy</b> y sin límite de resultados. Elegí una sola fuente o dispositivo (iPhone o Apple Watch). Extraé <b>Valor</b> con <b>Obtener detalles de muestras de Salud</b> y usá <b>Calcular estadísticas → Suma</b>. Guardá el resultado en la variable <b>DailySteps</b>.</li>
    <li>Repetí con <b>Energía activa</b>, de una sola fuente (normalmente Apple Watch), en <b>kcal</b>, para <b>hoy</b>. Guardá la suma como <b>DailyActiveKcal</b>. No incluyas energía basal o en reposo ni sumes estimaciones por pasos.</li>
    <li>Si alguna búsqueda no devuelve muestras, detené el Atajo y revisá los permisos o los datos en Salud. No envíes un cero inventado. En la primera ejecución, permití leer ambos tipos de datos.</li>
    <li>Agregá <b>Obtener contenido de URL</b> con la URL copiada. Método: <b>POST</b>. Encabezados: <b>Authorization</b> = <b>Bearer </b> seguido del token, y <b>Content-Type</b> = <b>application/json</b>. Cuerpo <b>JSON</b> con: <b>date</b> (Texto: fecha formateada), <b>steps</b> (Número: DailySteps), <b>activeKcal</b> (Número: DailyActiveKcal).</li>
    <li>Agregá <b>Mostrar resultado</b>. Ejecutá el Atajo: la respuesta debe incluir <b>ok: true</b>. Cerrá esta guía y tocá <b>Sincronizar</b>.</li>
    <li>Opcional: en <b>Atajos → Automatización → Hora del día</b>, ejecutalo cada noche. Elegí <b>Ejecutar inmediatamente</b> si está disponible. iOS puede pedir permisos, desbloquear el teléfono o una ejecución manual.</li>
    </ol><p class="notice">Los nombres de las acciones cambian según la versión de iOS. Sumar muestras superpuestas de iPhone y Watch duplica pasos: usá una sola fuente por métrica. El resultado puede diferir del total combinado de Salud. La web no puede crear un Atajo firmado por Apple; armalo en tu teléfono siguiendo esta guía.</p>`;
  const $ = (selector) => document.querySelector(selector);
  $("#health-token-create").onclick = async () => {
    const button = $("#health-token-create"),
      status = $("#health-setup-status");
    button.disabled = true;
    try {
      const response = await fetch("/api/health-token", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        status.textContent =
          response.status === 401
            ? "Sign in using the diary saving bar first, then reopen this guide."
            : "Could not create a connection token. Check cloud saving and try again.";
        return;
      }
      const data = await response.json();
      $("#health-url").value = new URL("/api/health", location.origin).href;
      $("#health-token").value = data.token;
      $("#health-credentials").hidden = false;
      status.textContent =
        "Copy the URL and token into your own Shortcut. This token is not saved in the browser.";
    } catch {
      status.textContent = "Connection unavailable. Try again when online.";
    } finally {
      button.disabled = false;
    }
  };
  for (const field of ["url", "token"])
    $("#health-copy-" + field).onclick = async () => {
      const input = $("#health-" + field);
      try {
        await navigator.clipboard.writeText(input.value);
        toast("Copied to clipboard");
      } catch {
        input.type = "text";
        input.select();
        toast("Select and copy the field manually");
      }
    };
  $("#health-check").onclick = async () => {
    const target = $("#health-check-result");
    try {
      const response = await fetch("/api/diary", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        target.textContent = `Cloud diary unavailable (HTTP ${response.status}). Fix diary saving first.`;
        return;
      }
      const data = await response.json();
      const imports = Object.entries(data.state?.days || {})
        .filter(([, day]) => day.health?.syncedAt)
        .sort((a, b) =>
          b[1].health.syncedAt.localeCompare(a[1].health.syncedAt),
        );
      target.textContent = imports.length
        ? `Last received: ${imports[0][0]} · ${new Date(imports[0][1].health.syncedAt).toLocaleString()}`
        : "No Apple Health import received yet. Run your Shortcut and check its response.";
    } catch {
      target.textContent =
        "Could not check the cloud diary. Retry when connected.";
    }
  };
}
