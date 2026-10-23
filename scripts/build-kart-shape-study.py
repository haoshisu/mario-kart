"""Original Kestrel kart: editable subdivision clay study, not a game asset.

Reference images inform surface quality and proportions only. No reference
pixels, brand emblems, character meshes or proprietary vehicle parts are used.
Game coordinates: Y-up, forward -Z. Modifiers remain editable in the .blend.
"""
import bpy
import bmesh
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "art-source/kestrel-study"
IMAGES = ROOT / "doc/images/kestrel-study"
OUT.mkdir(parents=True, exist_ok=True)
IMAGES.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def point(v):
    return Vector((v[0], -v[2], v[1]))

def clay(name, value):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (value, value, value, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = mat.diffuse_color
    shader.inputs["Roughness"].default_value = .52
    return mat

shell = clay("ClayShell", .34)
trim = clay("ClayEdge", .66)
rubber = clay("ClayTyre", .055)
mechanical = clay("ClayMechanical", .24)
seat_mat = clay("ClaySeat", .12)
parts = []

def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    parts.append(obj)
    return obj

def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name + "Cage")
    data.from_pydata([point(v) for v in vertices], [], faces)
    data.update()
    # Consistent outward normals avoid dark seams on reflective curves later.
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat)

def subdivide(obj, level=2):
    mod = obj.modifiers.new("EditableSurface", "SUBSURF")
    mod.levels = level
    mod.render_levels = level
    return obj

def loft(name, sections, mat, x_offset=0, exponent=.63, level=2):
    """Low-density longitudinal cage with rounded rectangular cross-sections."""
    count = 16
    vertices, faces = [], []
    for z, width, bottom, top in sections:
        for j in range(count):
            angle = j * math.tau / count
            c, s = math.cos(angle), math.sin(angle)
            x = math.copysign(abs(c) ** exponent, c) * width
            y = (bottom + top) / 2 + math.copysign(abs(s) ** exponent, s) * (top - bottom) / 2
            vertices.append((x + x_offset, y, z))
    faces.append(tuple(reversed(range(count))))
    for row in range(len(sections) - 1):
        for j in range(count):
            a = row * count + j
            b = row * count + (j + 1) % count
            faces.append((a, b, b + count, a + count))
    faces.append(tuple(range(len(vertices) - count, len(vertices))))
    return subdivide(mesh(name, vertices, faces, mat), level)

def curve(name, points, radius, mat, cyclic=False):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 12
    data.bevel_depth = radius
    data.bevel_resolution = 3
    data.use_fill_caps = True
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for handle, pos in zip(spline.bezier_points, points):
        handle.co = point(pos)
        handle.handle_left_type = handle.handle_right_type = "AUTO"
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    parts.append(obj)
    return obj

def block(name, pos, size, mat, bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=point(pos))
    obj = bpy.context.object
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new("SoftMachinedEdge", "BEVEL")
    mod.width, mod.segments = bevel, 3
    normal = obj.modifiers.new("WeightedNormals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    return finish(obj, name, mat)

def cylinder(name, a, b, radius, mat, segments=32):
    delta = point(b) - point(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments, radius=radius, depth=delta.length, location=(point(a)+point(b))/2)
    obj = bpy.context.object
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    return finish(obj, name, mat)

def lathe(name, profile, mat, center=(0,0,0), segments=48):
    vertices, faces = [], []
    for x, r in profile:
        for j in range(segments):
            angle = j * math.tau / segments
            vertices.append((center[0]+x, center[1]+math.sin(angle)*r, center[2]+math.cos(angle)*r))
    for row in range(len(profile)-1):
        for j in range(segments):
            a = row*segments+j
            b = row*segments+(j+1)%segments
            faces.append((a,b,b+segments,a+segments))
    return mesh(name,vertices,faces,mat)

# The silhouette is built from editable surface cages, with a dropped prow,
# arched cockpit shoulder and separate sweeping bumper; no flat wedge hood.
loft("ContinuousLowerHull", [
    (-1.13,.18,-.23,-.09),(-1.10,.38,-.25,-.04),(-.98,.52,-.26,.01),
    (-.78,.54,-.25,.04),(-.52,.53,-.23,.04),(-.20,.55,-.21,.055),
    (.13,.55,-.22,.055),(.40,.50,-.23,.06),(.70,.43,-.21,.10),
    (.91,.35,-.16,.11),(.98,.18,-.09,.06),(.99,.12,-.04,.015),
], mechanical)
loft("SculptedProw", [
    (-1.115,.18,-.12,-.025),(-1.09,.34,-.14,.04),(-1.01,.42,-.12,.14),
    (-.87,.47,-.08,.25),(-.65,.45,-.045,.32),(-.44,.35,-.01,.35),
    (-.32,.27,.045,.34),(-.30,.24,.09,.28),
], shell, exponent=.38)
for side in (-1,1):
    loft(f"SculptedSideIntake{side}", [
        (-.22,.05,-.04,.07),(-.19,.10,-.07,.15),(-.08,.125,-.09,.22),
        (.10,.13,-.085,.20),(.26,.105,-.06,.13),(.31,.06,-.03,.08),
    ], shell, side*.45, .40)
    for j in range(4):
        block(f"PodVent{side}_{j}",(side*.565,.11,.005+j*.047),(.012,.070,.020),mechanical,.005)
    curve(f"ExposedFrame{side}",[(side*.4,-.17,-.63),(side*.50,-.14,-.12),
        (side*.43,-.08,.46),(side*.29,.19,.67)],.018,trim)
    cylinder(f"FrontTieRod{side}",(side*.20,-.13,-.53),(side*.70,-.14,-.55),.017,trim)
    cylinder(f"RearHalfShaft{side}",(side*.28,-.14,.62),(side*.72,-.14,.62),.028,mechanical)
    cylinder(f"RearDamper{side}",(side*.45,-.14,.65),(side*.34,.16,.49),.025,mechanical)
    # A real helical suspension spring is readable in the rear clay view.
    start=Vector((side*.45,-.14,.65)); end=Vector((side*.34,.16,.49))
    axis=(end-start).normalized(); u=axis.cross(Vector((0,0,1))).normalized(); v=axis.cross(u)
    spring=[]
    for j in range(61):
        t=j/60; angle=t*math.tau*5
        spring.append(tuple(start+(end-start)*t+(u*math.cos(angle)+v*math.sin(angle))*.044))
    curve(f"SuspensionCoil{side}",spring,.007,trim)

# Broad swept front lip uses a rounded rectangular surface cage.
wing_points=[(-.82,-.94,.015,.025),(-.76,-1.07,.050,-.015),(-.52,-1.17,.075,-.065),(-.26,-1.205,.080,-.085),(0,-1.21,.080,-.09),(.26,-1.205,.080,-.085),(.52,-1.17,.075,-.065),(.76,-1.07,.050,-.015),(.82,-.94,.015,.025)]
vertices=[]; faces=[]
for x,z,width,y in wing_points:
    for j in range(12):
        angle=j*math.tau/12; c,s=math.cos(angle),math.sin(angle)
        vertices.append((x,y+math.copysign(abs(s)**.4,s)*.025,z+math.copysign(abs(c)**.4,c)*width))
faces.append(tuple(reversed(range(12))))
for row in range(len(wing_points)-1):
    for j in range(12):
        a=row*12+j; b=row*12+(j+1)%12
        faces.append((a,b,b+12,a+12))
faces.append(tuple(range(len(vertices)-12,len(vertices))))
subdivide(mesh("SweptFrontApron",vertices,faces,trim))

# Thin formed seat shell with a real open cockpit, rather than a solid block.
seat_vertices=[]; seat_faces=[]
seat_rows=[(-.07,.21,.075),(.02,.245,.035),(.23,.25,.035),(.40,.245,.11),
           (.49,.225,.24),(.54,.22,.37),(.55,.23,.46),(.555,.23,.48)]
for z,width,y in seat_rows:
    for j in range(9):
        t=(j-4)/4
        seat_vertices.append((width*t,y+abs(t)**3*.09,z))
for row in range(len(seat_rows)-1):
    for j in range(8):
        a=row*9+j;seat_faces.append((a,a+1,a+10,a+9))
bucket=subdivide(mesh("FormedBucketSeat",seat_vertices,seat_faces,seat_mat))
solid=bucket.modifiers.new("SeatShellThickness","SOLIDIFY");solid.thickness=.022
for side in (-1,1):
    curve(f"SeatRolledLip{side}",[(side*w,y+.09,z) for z,w,y in seat_rows],.012,trim)
    curve(f"SeatHarness{side}",[(side*.10,.09,.03),(side*.13,.17,.43),(side*.12,.44,.55)],.013,mechanical)

# Sculpted instrument binnacle and anatomically placed steering wheel.
loft("InstrumentBinnacle",[(-.36,.18,.20,.28),(-.31,.22,.18,.33),(-.25,.19,.20,.34),(-.23,.16,.24,.31)],mechanical)
block("InstrumentScreen",(0,.33,-.25),(.12,.012,.06),trim,.008)
curve("ContinuousSteeringWheel",[(math.cos(j*math.tau/12)*.17,
    .405+math.sin(j*math.tau/12)*.133,-.175+math.sin(j*math.tau/12)*.074) for j in range(12)],.018,mechanical,True)
for side in (-1,1):
    cylinder(f"SteeringSpoke{side}",(0,.405,-.175),(side*.15,.405,-.175),.012,trim)
cylinder("SteeringColumn",(0,.17,-.39),(0,.405,-.175),.02,trim)
for side in (-1,1):
    block(f"Pedal{side}",(side*.12,-.01,-.53),(.10,.025,.12),trim,.012)

# Distinctive single central turbine housing and split rear diffuser replace
# the reference's two cannon-like exhausts and proprietary wheel mechanism.
loft("RearEngineCowl",[(.63,.23,-.035,.23),(.67,.27,-.04,.27),
    (.81,.26,-.03,.24),(.89,.21,-.005,.18),(.93,.12,.04,.12)],shell)
for i in range(5):
    block(f"EngineCoolingSlit{i}",(0,.272-i*.006,.695+i*.032),(.30,.012,.013),mechanical,.004)
cylinder("CentralExhaustBody",(0,.12,.80),(0,.12,.98),.085,mechanical)
cylinder("CentralExhaustLip",(0,.12,.965),(0,.12,1.015),.096,trim)
cylinder("ExhaustDarkOpening",(0,.12,1.015),(0,.12,1.02),.074,rubber)
for side in (-1,1):
    loft(f"RearFlyingButtress{side}",[(.31,.025,.07,.10),(.37,.075,.05,.15),
        (.54,.08,.09,.27),(.78,.07,.12,.25),(.92,.025,.13,.20)],trim,side*.36)
    for j in range(3):
        block(f"DiffuserFin{side}_{j}",(side*(.15+j*.10),-.19,.86),(.023,.12,.24),mechanical,.008)
    block(f"TailLightHousing{side}",(side*.28,.02,.945),(.13,.04,.045),trim,.012)

# Wide rounded tyres: lathed shoulders, recessed rim, split spokes and tread.
for x in (-.72,.72):
    side=1 if x>0 else -1
    for z in (-.55,.62):
        tag=f"{side}_{z}"
        center=(x,-.14,z)
        lathe(f"Tyre{tag}",[(-.15,.172),(-.151,.218),(-.133,.264),(-.095,.287),
            (-.06,.29),(-.047,.29),(-.042,.285),(-.036,.285),(-.031,.29),(.031,.29),(.036,.285),(.042,.285),(.047,.29),(.06,.29),(.095,.287),(.133,.264),(.151,.218),(.15,.172)],rubber,center,64)
        for face in (-1,1):
            lathe(f"ForgedRim{tag}_{face}",[(face*.125,.134),(face*.139,.145),
                (face*.148,.173),(face*.150,.184),(face*.136,.190),(face*.126,.174)],trim,center,48)
            cylinder(f"Hub{tag}_{face}",(x+face*.126,-.14,z),(x+face*.155,-.14,z),.048,mechanical)
            for j in range(6):
                angle=j*math.tau/6
                for split in (-1,1):
                    cylinder(f"SplitSpoke{tag}_{face}_{j}_{split}",
                        (x+face*.129,-.14+math.sin(angle)*.045,z+math.cos(angle)*.045),
                        (x+face*.140,-.14+math.sin(angle+split*.12)*.17,z+math.cos(angle+split*.12)*.17),.010,trim,12)
                cylinder(f"Lug{tag}_{face}_{j}",
                    (x+face*.153,-.14+math.sin(angle)*.035,z+math.cos(angle)*.035),
                    (x+face*.161,-.14+math.sin(angle)*.035,z+math.cos(angle)*.035),.007,trim,8)

# Verify evaluated geometry and save the modelling scene before studio setup.
bpy.context.view_layer.update()
depsgraph=bpy.context.evaluated_depsgraph_get()
stats={"name":"Kestrel clay study","stage":"shape review, not runtime LOD","objects":len(parts),"triangles":0,"non_finite_vertices":0}
for obj in parts:
    evaluated=obj.evaluated_get(depsgraph)
    data=evaluated.to_mesh()
    data.calc_loop_triangles()
    stats["triangles"]+=len(data.loop_triangles)
    stats["non_finite_vertices"]+=sum(not all(math.isfinite(v) for v in vertex.co) for vertex in data.vertices)
    evaluated.to_mesh_clear()
assert stats["non_finite_vertices"]==0
(OUT/"geometry.json").write_text(json.dumps(stats,indent=2)+"\n")
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"kestrel-clay.blend"))

floor=clay("StudioFloor",.30)
bpy.ops.mesh.primitive_plane_add(size=200,location=point((0,-.431,0)))
bpy.context.object.data.materials.append(floor)
for pos,power,size in [((2.5,4,-2.5),650,4),((-3,2,-1),450,3),((1,3,3),800,3)]:
    bpy.ops.object.light_add(type="AREA",location=point(pos))
    lamp=bpy.context.object
    lamp.data.energy, lamp.data.size=power,size
    lamp.rotation_euler=(point((0,.1,0))-lamp.location).to_track_quat("-Z","Y").to_euler()
bpy.ops.object.camera_add()
camera=bpy.context.object
scene=bpy.context.scene
scene.camera=camera
camera.data.type="ORTHO"
scene.render.engine="CYCLES"
scene.cycles.samples=40
scene.cycles.use_denoising=True
scene.world.color=(.25,.25,.25)
scene.view_settings.exposure=-.6
scene.render.resolution_x=1200
scene.render.resolution_y=1000
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
views=[("front",(2.7,1.85,-3.3),3.2), ("top",(0,4,-.05),2.75),
       ("rear",(-2.7,1.8,3.1),3.2), ("side",(4,.6,0),2.9)]
for name,pos,scale in views:
    camera.location=point(pos)
    camera.rotation_euler=(point((0,.04,0))-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.ortho_scale=scale
    scene.render.filepath=str(IMAGES/f"{name}.png")
    bpy.ops.render.render(write_still=True)
print(json.dumps(stats))
