import { TRACK_IDS } from "../../src/game/track/trackCatalog";
import { expect, test } from "@playwright/test";
import { driveRace } from "./driveRace";
import { getTrackData } from "../../src/game/track/trackData";
import { THEME_PARK_DISTRICTS } from "../../src/game/track/themeParks";
import { TEST_SNAPSHOT_EVENT } from "../../src/game/network/snapshotDiagnostics";
import type { RaceSnapshot } from "../../src/game/network/protocol";

const parks = [["taipei", "霓虹疊城"], ["jiufen", "金霧飛城"], ["kaohsiung", "轉港狂潮"], ["alishan", "雲海追光"]] as const;
for (const [id, name] of parks) for (const shortcut of [false, true]) {
  test(`${id} drives every park district and a legal lap via ${shortcut ? "shortcut" : "main road"}`, async ({ page }) => {
    test.setTimeout(160_000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/game?e2e=1&stats=1");
    await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.getByTestId("map-shortcut")).toHaveCount(1);
    await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
    const branch = getTrackData(id).branches[0], middle = branch.samples[Math.floor(branch.samples.length / 2)];
    const districts = THEME_PARK_DISTRICTS[id];
    await page.evaluate(({ districts, middle, eventName }) => {
      const seen: number[] = []; let branchSeen = false, lap = 0;
      const receive = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const player = (event.detail as RaceSnapshot).players.find(player => player.nickname === "玩家");
        if (!player || player.status !== "racing") return;
        const fraction = player.raceFraction * player.totalLaps - player.completedLaps;
        const section = districts.findIndex(section => fraction >= section.from + .04 && fraction < section.to);
        if (section >= 0 && !seen.includes(section)) seen.push(section);
        if (Math.hypot(player.position[0] - middle.position[0], player.position[2] - middle.position[1]) < 4 && Math.abs(player.position[1] - middle.height - .52) < 1) branchSeen = true;
        lap = player.completedLaps;
        document.documentElement.dataset.themeParkEvidence = JSON.stringify({ seen, branchSeen, lap });
        if (lap >= 1) {
          window.removeEventListener(eventName, receive);
          window.setTimeout(() => window.dispatchEvent(new Event("kart-race-test-stop-drive")), 0);
        }
      };
      window.addEventListener(eventName, receive);
    }, { districts, middle, eventName: TEST_SNAPSHOT_EVENT });
    await page.getByTestId("start-race").click();
    await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
    await page.evaluate(() => {
      let triangles = 0, calls = 0;
      const timer = window.setInterval(() => {
        const diagnostics = document.querySelector<HTMLElement>('[data-testid="render-diagnostics"]');
        triangles = Math.max(triangles, Number(diagnostics?.dataset.triangles) || 0);
        calls = Math.max(calls, Number(diagnostics?.dataset.calls) || 0);
        document.documentElement.dataset.taiwanPeakRender = JSON.stringify({ triangles, calls });
      }, 1000);
      window.addEventListener("kart-race-test-stop-drive", () => window.clearInterval(timer), { once: true });
    });
    const drive = driveRace(page, "玩家", "keyboard", 140_000, 0, false, id, false, shortcut);
    try {
      for (let index = 0; index < districts.length; index++) {
        await page.waitForFunction(index => {
          const data = document.documentElement.dataset.themeParkEvidence;
          return data ? (JSON.parse(data) as { seen: number[] }).seen.includes(index) : false;
        }, index, { timeout: 125_000 });
        await page.screenshot({ path: `/tmp/taiwan-${id}-${shortcut ? "cut" : "main"}-${index}.png` });
      }
      const result = await drive;
      const evidence = await page.evaluate(() => JSON.parse(document.documentElement.dataset.themeParkEvidence ?? "{}") as { seen: number[]; branchSeen: boolean; lap: number });
      if (id === "alishan") {
        const peak = await page.evaluate(() => JSON.parse(document.documentElement.dataset.taiwanPeakRender ?? "{}") as { triangles: number });
        expect(peak.triangles).toBeLessThanOrEqual(200000);
      }
      expect(evidence.seen).toHaveLength(districts.length);
      expect(evidence.lap).toBeGreaterThanOrEqual(1); expect(result.laps).toBeGreaterThanOrEqual(1);
      if (shortcut) expect(evidence.branchSeen).toBe(true);
      console.log(id, shortcut ? "shortcut" : "main", evidence, "peak", await page.evaluate(() => document.documentElement.dataset.taiwanPeakRender), await page.getByTestId("render-diagnostics").textContent());
      expect(errors).toEqual([]);
    } finally {
      await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive"))); await drive;
      await page.getByRole("button", { name: "顯示 QR Code" }).click();
      await page.getByRole("button", { name: "關閉房間" }).click();
    }
  });
}

for (const [id, name] of parks) {
  test(`${id} big jump visibly flies, spins and grants landing turbo`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto("/game?e2e=1&stats=1");
    await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
    const flight = page.evaluate(({ eventName, timed }) => new Promise<{ peak: number; spin: number; turbo: number }>(resolve => {
      let flying = false, peak = 0, spin = 0;
      const receive = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const player = (event.detail as RaceSnapshot).players.find(player => player.nickname === "玩家");
        if (!player) return;
        if (player.stuntProgress > 0) {
          if (!flying && timed) { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true })); window.setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", bubbles: true })), 100); }
          flying = true; peak = Math.max(peak, player.position[1]); spin = Math.max(spin, player.stuntProgress); }
        else if (flying) { window.removeEventListener(eventName, receive); resolve({ peak, spin, turbo: player.turboTier }); }
      };
      window.addEventListener(eventName, receive);
    }), { eventName: TEST_SNAPSHOT_EVENT, timed: id === "taipei" });
    await page.getByTestId("start-race").click();
    await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
    const drive = driveRace(page, "玩家", "keyboard", 105_000, 2, false, id, false);
    try {
      const player = page.getByTestId("multiplayer-runtime").locator("span", { hasText: "玩家" });
      await expect.poll(async () => Number(await player.getAttribute("data-stunt-progress")), { timeout: 95_000, intervals: [50] }).toBeGreaterThan(.2);
      await page.screenshot({ path: `/tmp/taiwan-${id}-big-jump.png` });
      const result = await flight;
      expect(result.peak).toBeGreaterThan(getTrackData(id).ramps[0].height + 2.5);
      expect(result.spin).toBe(1); expect(result.turbo).toBe(2); expect(errors).toEqual([]);
    } finally {
      await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive"))); await drive;
      await page.getByRole("button", { name: "顯示 QR Code" }).click(); await page.getByRole("button", { name: "關閉房間" }).click();
    }
  });
}

test("track picker renders all new previews on a small screen", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/game?e2e=1&stats=1");
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
  const picker = page.getByRole("group", { name: "選擇賽道" });
  await expect(picker.getByRole("button")).toHaveCount(TRACK_IDS.length);
  for (const [id, name] of parks) {
    await picker.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.locator(".game-canvas")).toHaveAttribute("data-track-id", id);
    await expect(page.getByTestId("course-map")).toHaveAttribute("aria-label", `${getTrackData(id).name}賽道地圖`);
    await expect(page.getByTestId("map-shortcut")).toHaveCount(1);
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    const box = await picker.getByRole("button", { name: new RegExp(name) }).boundingBox();
    if (!box) throw new Error("Missing track card");
    expect(box.x + box.width).toBeLessThanOrEqual(844);
    await page.screenshot({ path: `/tmp/new-picker-${id}.png` });
  }
  expect(errors).toEqual([]);
});


test("kaohsiung rotating reward bridge remains aligned while occupied and grants boost", async ({page}) => {
  test.setTimeout(160_000);
  const errors: string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/game?e2e=1&stats=1");
  await page.getByRole("combobox",{name:"畫質"}).selectOption("low");
  await page.getByRole("button",{name:/轉港狂潮/}).click();
  await expect(page.getByTestId("map-risk-route")).toHaveCount(1);
  await page.getByRole("button",{name:"單人對戰・鍵盤",exact:true}).click();
  const branch=getTrackData("kaohsiung").branches[1],middle=branch.samples[Math.floor(branch.samples.length/2)];
  await page.evaluate(({middle,eventName})=>{
    let visited=false,boost=false,lap=0;
    const receive=(event:Event)=>{
      if(!(event instanceof CustomEvent))return;
      const snapshot=event.detail as RaceSnapshot,player=snapshot.players.find(p=>p.nickname==="玩家");if(!player)return;
      if(Math.hypot(player.position[0]-middle.position[0],player.position[2]-middle.position[1])<12 && Math.abs(player.position[1]-.52-middle.height)<1){
        visited ||= snapshot.bridge?.angle===0 && snapshot.bridge.locked;boost ||= player.item.boostRemaining>0;
      }
      lap=player.completedLaps;document.documentElement.dataset.bridgeEvidence=JSON.stringify({visited,boost,lap});
      if(lap>=1){window.removeEventListener(eventName,receive);window.setTimeout(()=>window.dispatchEvent(new Event("kart-race-test-stop-drive")),0);}
    };window.addEventListener(eventName,receive);
  },{middle,eventName:TEST_SNAPSHOT_EVENT});
  await page.getByTestId("start-race").click();
  await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase","racing");
  const drive=driveRace(page,"玩家","keyboard",140_000,0,false,"kaohsiung",false,true,1);
  try{
    await page.waitForFunction(()=>{const raw=document.documentElement.dataset.bridgeEvidence;return raw && (JSON.parse(raw) as {visited:boolean}).visited;},undefined,{timeout:100_000});
    await page.screenshot({path:"/tmp/taiwan-kaohsiung-bridge.png"});
    const result=await drive;expect(result.laps).toBeGreaterThanOrEqual(1);
    expect(await page.evaluate(()=>JSON.parse(document.documentElement.dataset.bridgeEvidence??"{}"))).toMatchObject({visited:true,boost:true,lap:1});
    expect(errors).toEqual([]);
  }finally{
    await page.evaluate(()=>window.dispatchEvent(new Event("kart-race-test-stop-drive")));await drive;
    await page.getByRole("button",{name:"顯示 QR Code"}).click();await page.getByRole("button",{name:"關閉房間"}).click();
  }
});
