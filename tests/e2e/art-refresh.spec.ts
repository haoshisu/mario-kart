import {expect,test} from "@playwright/test";
const tracks=[["taipei","霓虹疊城"],["jiufen","金霧飛城"],["kaohsiung","轉港狂潮"],["alishan","雲海追光"]] as const;
for(const [id,name] of tracks) test(`${id} realistic arcade materials and Kestrel kart render in standard and low quality`,async({page})=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/game?mode=solo&e2e=1&stats=1");
  await page.getByRole("button",{name:new RegExp(name)}).click();
  await expect(page.locator(".game-canvas")).toHaveAttribute("data-track-id",id);
  await expect(page.getByTestId("kart-runtime")).toHaveAttribute("data-race-phase","RACING",{timeout:15000});
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  await page.waitForTimeout(4000);
  await page.screenshot({path:`/tmp/art-${id}-standard.png`});
  await page.keyboard.down("KeyW");await page.waitForTimeout(3000);await page.keyboard.up("KeyW");
  expect(Number(await page.getByTestId("kart-runtime").getAttribute("data-speed"))).toBeGreaterThan(5);
  await page.screenshot({path:`/tmp/art-${id}-driving.png`});
  await page.getByRole("combobox",{name:"畫質"}).selectOption("low");
  await page.waitForTimeout(4000);
  await page.screenshot({path:`/tmp/art-${id}-low.png`});
  console.log(id,await page.getByTestId("render-diagnostics").textContent());
  expect(errors).toEqual([]);
});

test("four Kestrel karts render distinct paint and the scene survives a mobile viewport",async({page})=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/game?e2e=1&stats=1");
  await page.getByRole("button",{name:/霓虹疊城/}).click();
  await page.getByRole("button",{name:"單人對戰・鍵盤",exact:true}).click();
  await expect(page.locator(".player-nameplate")).toHaveCount(4);
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  await page.waitForTimeout(4000);
  await page.screenshot({path:"/tmp/art-four-cars.png"});
  console.log("four cars standard",await page.getByTestId("render-diagnostics").textContent());
  await page.setViewportSize({width:844,height:390});
  await page.getByRole("combobox",{name:"畫質"}).selectOption("low");
  await page.waitForTimeout(3000);
  await expect(page.locator(".player-nameplate")).toHaveCount(4);
  await page.screenshot({path:"/tmp/art-mobile.png"});
  console.log("four cars low",await page.getByTestId("render-diagnostics").textContent());
  expect(Number(await page.getByTestId("render-diagnostics").getAttribute("data-triangles"))).toBeLessThanOrEqual(200000);
  await page.getByRole("button",{name:"關閉房間",exact:true}).click();
  expect(errors).toEqual([]);
});

test("Kestrel loads both mesh qualities, celebrates, and returns to the steering pose on restart",async({page})=>{
  test.setTimeout(60000);
  const errors:string[]=[], models:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("response",response=>{
    if(/\/models\/(kestrel|chibi)-/.test(response.url())) models.push(response.url().split("/").at(-1) ?? "");
  });
  await page.goto("/game?mode=solo&e2e=1&stats=1");
  const runtime=page.getByTestId("kart-runtime");
  await expect(runtime).toHaveAttribute("data-race-phase","RACING",{timeout:20000});
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  for(let i=0;i<12;i++){
    await page.evaluate(()=>window.dispatchEvent(new Event("kart-race-test-advance")));
    await page.waitForTimeout(35);
  }
  await expect(runtime).toHaveAttribute("data-race-phase","FINISHED");
  // Hide only the result overlay while photographing the actual rendered pose.
  const photoStyle = await page.addStyleTag({ content: ".finish-screen { visibility: hidden; }" });
  await page.waitForTimeout(500);
  await page.screenshot({path:"/tmp/kestrel-victory-standard.png"});
  await page.getByRole("combobox",{name:"畫質"}).selectOption("low");
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  await page.waitForTimeout(700);
  await page.screenshot({path:"/tmp/kestrel-victory-low.png"});
  await photoStyle.evaluate(element => element.parentNode?.removeChild(element));
  await page.getByRole("button",{name:"重新比賽"}).click();
  await expect(runtime).toHaveAttribute("data-completed-laps","0");
  await expect(runtime).toHaveAttribute("data-race-phase","RACING",{timeout:15000});
  await page.screenshot({path:"/tmp/kestrel-restart.png"});
  expect(models).toEqual(expect.arrayContaining(["chibi-dodo-v1.glb","chibi-dodo-low-v1.glb","kestrel-wheel-v1.glb"]));
  expect(errors).toEqual([]);
});
