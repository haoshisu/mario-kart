"""Original Dodo character study. Run using Blender --background --python this-file.

Design artifact only: does not replace the approved in-game Aster driver.
Blender Z-up, front -Y; GLB export converts to game Y-up.
"""
from pathlib import Path
import json
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'art-source/dodo-racer'
OUT.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, roughness=.45, metal=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    return m


skin = material('Warm peach', (.72, .36, .20), .5)
teal = material('Lagoon suit', (.015, .28, .28), .48)
cream = material('Ivory panels', (.88, .81, .63), .5)
orange = material('Tangerine accent', (.95, .18, .035), .35)
navy = material('Midnight rubber', (.018, .032, .047), .56)
hair = material('Espresso hair', (.055, .022, .018), .48)
white = material('Eye white', (.97, .95, .86), .3)
iris = material('Hazel iris', (.09, .23, .15), .3)
black = material('Pupils', (.006, .01, .012), .3)
lens = material('Amber goggle lenses', (.38, .14, .018), .22, .45)
metal = material('Brushed brass', (.62, .36, .10), .3, .65)


def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    if obj.type == 'MESH':
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def ellipsoid(name, loc, scale, mat, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat)


def box(name, loc, scale, mat, bevel=.06):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new('Soft manufactured corners', 'BEVEL')
    mod.width = bevel
    mod.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, mat)


def stroke(name, points, radius, mat):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = 'AUTO'
        point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat)


def limb(name, a, b, radius, mat):
    obj = ellipsoid(name, (Vector(a)+Vector(b))/2, (radius, radius, (Vector(b)-Vector(a)).length/2+radius*.4), mat)
    obj.rotation_euler = (Vector(b)-Vector(a)).to_track_quat('Z', 'Y').to_euler()
    return obj


# Broad compact boots and padded flight-suit silhouette: readable at kart scale.
for s in (-1, 1):
    x = s*.20
    box(f'{s} boot sole', (x, -.075, .095), (.32, .48, .12), navy, .055)
    box(f'{s} boot', (x, -.055, .205), (.30, .42, .23), cream, .085)
    box(f'{s} toe guard', (x, -.25, .18), (.28, .09, .14), orange, .035)
    limb(f'{s} trouser', (x, .025, .30), (x*.9, .035, .78), .158, teal)
    box(f'{s} knee patch', (x, -.126, .50), (.19, .05, .18), navy, .05)
    stroke(f'{s} boot seam', [(x-.09, -.275, .23), (x, -.29, .25), (x+.09, -.275, .23)], .012, cream)
ellipsoid('Suit body', (0, .035, .96), (.38, .235, .41), teal)
box('Utility belt', (0, .015, .78), (.70, .55, .10), navy, .045)
box('Belt buckle', (0, -.285, .78), (.13, .055, .10), metal, .025)
ellipsoid('Ivory chest panel', (0, -.191, 1.08), (.245, .055, .225), cream)
stroke('Central orange zipper', [(0, -.25, .85), (0, -.258, 1.10), (0, -.205, 1.29)], .018, orange)
# Original twin-chevron badge.
for z in (1.06, 1.13):
    stroke('Team double chevron', [(.075, -.253, z+.025), (.12, -.265, z), (.165, -.25, z+.025)], .014, teal)
for s in (-1, 1):
    shoulder = (s*.33, .02, 1.20)
    elbow = (s*.47, -.005, .98)
    wrist = (s*.51, -.12, .82)
    limb(f'{s} upper sleeve', shoulder, elbow, .135, teal)
    ellipsoid(f'{s} shoulder cap', (s*.35, -.005, 1.22), (.145, .16, .115), orange)
    limb(f'{s} forearm', elbow, wrist, .115, teal)
    limb(f'{s} cuff', (s*.50, -.10, .86), (s*.52, -.135, .79), .12, cream)
    ellipsoid(f'{s} glove', (s*.525, -.145, .735), (.12, .11, .14), navy)
    ellipsoid(f'{s} thumb', (s*.44, -.20, .76), (.055, .065, .075), navy)
    box(f'{s} glove pad', (s*.535, -.24, .75), (.12, .035, .09), orange, .025)
ellipsoid('Collar', (0, .015, 1.30), (.20, .18, .10), navy)
ellipsoid('Neck', (0, 0, 1.39), (.13, .125, .15), skin)

# Oversized pear-shaped head with a continuous cheek/jaw outline.
head = ellipsoid('Head', (0, 0, 1.79), (.40, .325, .43), skin, 48, 32)
for v in head.data.vertices:
    h = v.co.z/.43
    v.co.x *= 1-.13*max(0, h)
for s in (-1, 1):
    ellipsoid(f'{s} ear', (s*.385, .005, 1.77), (.083, .075, .123), skin)
    ellipsoid(f'{s} ear inset', (s*.42, -.048, 1.77), (.028, .02, .064), orange)
# Shallow eye volumes with eyelids and individually aimed pupils.
for s in (-1, 1):
    x = s*.145
    ellipsoid(f'{s} eye', (x, -.285, 1.84), (.106, .042, .133), white)
    ellipsoid(f'{s} iris', (x+.009, -.325, 1.835), (.050, .015, .071), iris)
    ellipsoid(f'{s} pupil', (x+.009, -.338, 1.836), (.027, .008, .046), black)
    ellipsoid(f'{s} eye glint', (x-.007, -.346, 1.862), (.012, .005, .016), white, 12, 8)
    stroke(f'{s} upper eyelid', [(x-.10, -.303, 1.87), (x-.065, -.322, 1.957), (x+.035, -.322, 1.966), (x+.095, -.30, 1.90)], .012, skin)
    stroke(f'{s} eyebrow', [(x-.08, -.275, 2.015), (x, -.293, 2.037), (x+.075, -.269, 2.02)], .023, hair)
ellipsoid('Rounded nose', (0, -.33, 1.745), (.078, .084, .079), skin)
stroke('Smile', [(-.125, -.286, 1.64), (-.065, -.314, 1.618), (.025, -.321, 1.62), (.12, -.29, 1.662)], .012, hair)
stroke('Lower lip', [(-.05, -.307, 1.59), (0, -.318, 1.585), (.055, -.302, 1.60)], .009, skin)
# Hair cap is an upper hemisphere, so the face stays open.
verts, faces = [], []
for j in range(13):
    angle = (j/12)*math.pi*.55
    for i in range(48):
        a = i*math.tau/48
        verts.append((.404*math.sin(angle)*math.cos(a), .331*math.sin(angle)*math.sin(a)+.025, 1.82+.415*math.cos(angle)))
for j in range(12):
    for i in range(48):
        a=j*48+i; b=j*48+(i+1)%48
        faces.append((a,b,b+48,a+48))
mesh=bpy.data.meshes.new('Hair cap mesh');mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new('Sculpted hair cap',mesh);bpy.context.collection.objects.link(obj);finish(obj,'Sculpted hair cap',hair)
for i, (x,z,angle) in enumerate([(-.20,2.14,-.5),(-.06,2.25,-.35),(.10,2.27,-.45),(.24,2.19,-.6)]):
    obj=ellipsoid(f'Swept hair lock {i}', (x,-.12,z), (.105,.21,.20),hair)
    obj.rotation_euler[1]=angle
# Goggles perched on the crown, separate from the eyes.
stroke('Goggle headband', [(-.36,.03,2.03),(-.36,.23,2.08),(0,.35,2.11),(.36,.23,2.08),(.36,.03,2.03)], .037, navy)
for s in (-1,1):
    x=s*.17
    box(f'{s} goggle frame', (x,-.255,2.115), (.285,.12,.18), orange,.065)
    box(f'{s} goggle gasket', (x,-.321,2.115), (.24,.035,.14), navy,.045)
    box(f'{s} amber glass', (x,-.343,2.12), (.205,.025,.105), lens,.038)
    stroke(f'{s} lens reflection', [(x-.067,-.36,2.145),(x+.01,-.36,2.155)],.008,cream)
box('Goggle bridge',(0,-.27,2.115),(.075,.09,.045),metal,.018)

# Export only character geometry, without studio props or lights.
character=list(bpy.context.scene.objects)
for obj in character:
    if obj.type=='CURVE':
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'dodo-racer-v1.glb'),export_format='GLB',use_selection=True,export_yup=True)
triangles=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in bpy.context.scene.objects if obj.type=='MESH')
(OUT/'metrics.json').write_text(json.dumps({'triangles':triangles,'materials':len(bpy.data.materials),'rigged':False,'usage':'Standalone character design study; not runtime optimized'},indent=2))

floor=material('Studio backdrop',(.035,.065,.085),.75)
box('Display plinth',(0,0,-.075),(1.65,1.3,.15),navy,.10)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.155));finish(bpy.context.object,'Studio floor',floor)
for loc,power,size in [((3,-4,6),650,4),((-3,-2,3),400,3),((1,3,4),850,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object
    light.data.energy=power;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(Vector((0,0,1.2))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-6,2.7));camera=bpy.context.object
scene=bpy.context.scene;scene.camera=camera
camera.data.type='ORTHO';camera.data.ortho_scale=3.15
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.world.color=(.18,.18,.18)
scene.view_settings.view_transform='AgX'
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
for name,loc in [('hero',(3,-6,2.7)),('front',(0,-7,2.1)),('back',(3,6,2.7))]:
    camera.location=loc;camera.rotation_euler=(Vector((0,0,1.13))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/f'dodo-{name}.png')
    if name=='hero':
        for area in bpy.context.screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_perspective='CAMERA'
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'dodo-racer-v1.blend'))
    bpy.ops.render.render(write_still=True)
print('DODO_STUDY_COMPLETE',triangles)
