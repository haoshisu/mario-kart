import { expect, test, type Page } from "@playwright/test";
import {getTrackData} from "../../src/game/track/trackData";
function practiceRoute(){
  const track=getTrackData("kaohsiung"),branch=track.branches[1],main=track.race.RACE_ROUTE_SAMPLES;
  return [...main.filter(p=>p.raceProgress<branch.entryProgress),...branch.samples,...main.filter(p=>p.raceProgress>branch.exitProgress)];
}
function drivePractice(page: Page) {
  return page.getByTestId("kart-runtime").evaluate((element, { route, lane }) => new Promise<void>(resolve => {
    const keys = new Set<string>();
    let accumulator = 0;
    const key = (code: string, pressed: boolean) => {
      if (keys.has(code) === pressed) return;
      if (pressed) keys.add(code); else keys.delete(code);
      window.dispatchEvent(new KeyboardEvent(pressed ? "keydown" : "keyup", { code, bubbles: true }));
    };
    const finish = () => {
      window.clearInterval(interval); window.clearTimeout(timeout);
      window.removeEventListener("kart-race-test-stop-drive", finish);
      for (const code of [...keys]) key(code, false);
      resolve();
    };
    const interval = window.setInterval(() => {
      const x = Number(element.getAttribute("data-x")), z = Number(element.getAttribute("data-z"));
      const yaw = Number(element.getAttribute("data-yaw")), speed = Number(element.getAttribute("data-speed"));
      const airborne = Number(element.getAttribute("data-stunt-progress")) > 0;
      let nearest = 0, distance = Infinity;
      route.forEach((sample, i) => {
        const gap = Math.hypot(sample.position[0] - x, sample.position[1] - z, sample.height - Number(element.getAttribute("data-y")) + .52);
        if (gap < distance) { nearest = i; distance = gap; }
      });
      const target = route[(nearest + 7) % route.length];
      const dx = target.position[0] + target.normal[0] * lane - x;
      const dz = target.position[1] + target.normal[1] * lane - z;
      const difference = Math.atan2(-dx, -dz) - yaw;
      const error = Math.atan2(Math.sin(difference), Math.cos(difference));
      const steer = Math.max(-1, Math.min(1, -2 * Math.max(4, speed) * Math.sin(error) /
        (Math.max(1, Math.hypot(dx, dz)) * 1.95 * (airborne ? .45 : 1))));
      accumulator += Math.abs(steer);
      const direction = accumulator >= 1 ? Math.sign(steer) : 0;
      if (direction) accumulator -= 1;
      key("KeyA", direction < 0); key("KeyD", direction > 0);
      const targetSpeed = Math.abs(error) > .45 ? 9 : 14;
      key("KeyW", speed <= targetSpeed); key("KeyS", speed > targetSpeed + 1);
    }, 50);
    const timeout = window.setTimeout(finish, 140_000);
    window.addEventListener("kart-race-test-stop-drive", finish);
  }), { route: practiceRoute(), lane: 0 });
}


test("practice physics traverses the Kaohsiung moving bridge and completes a legal lap",async({page})=>{
  test.setTimeout(160_000);
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/game?mode=solo&e2e=1&stats=1");
  await page.getByRole("combobox",{name:"畫質"}).selectOption("low");
  await page.getByRole("button",{name:/轉港狂潮/}).click();
  const runtime=page.getByTestId("kart-runtime");await expect(runtime).toHaveAttribute("data-race-phase","RACING");
  const drive=drivePractice(page),branch=getTrackData("kaohsiung").branches[1],middle=branch.samples[Math.floor(branch.samples.length/2)];
  try{
    await expect.poll(async()=>{
      const x=Number(await runtime.getAttribute("data-x")),z=Number(await runtime.getAttribute("data-z")),y=Number(await runtime.getAttribute("data-y"));
      return Math.hypot(x-middle.position[0],z-middle.position[1],y-.52-middle.height);
    },{timeout:100_000}).toBeLessThan(10);
    await page.screenshot({path:"/tmp/taiwan-kaohsiung-practice-bridge.png"});
    await expect.poll(async()=>Number(await runtime.getAttribute("data-completed-laps")),{timeout:70_000}).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
  }finally{await page.evaluate(()=>window.dispatchEvent(new Event("kart-race-test-stop-drive")));await drive;}
});
