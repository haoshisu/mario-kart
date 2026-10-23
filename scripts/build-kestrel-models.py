"""Finish the approved original Kestrel surface study for the game.

Retain the editable accepted study; export separate, batched runtime body and
wheels in Y-up metres. Character, materials and details are project originals.
"""
import bpy
import bmesh
import math
import json
from pathlib import Path
from runpy import run_path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art-source"
PUBLIC = ROOT / "public/models"
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.open_mainfile(filepath=str(SOURCE / "kestrel-study/kestrel-clay.blend"))

def point(v): return Vector((v[0], -v[2], v[1]))

def material(name, color, metal=0, rough=.5, coat=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Coat Weight"].default_value = coat
    if emission:
        shader.inputs["Emission Color"].default_value = (*color, 1)
        shader.inputs["Emission Strength"].default_value = emission
    return mat

paint = material("PlayerPaint", (.52,.018,.040), .45,.24,.85)
ivory = material("CeramicIvory", (.72,.76,.73), .12,.3,.35)
carbon = material("CarbonComposite", (.012,.022,.035), .18,.5)
alloy = material("BrushedAlloy", (.48,.53,.58), .9,.22)
fabric = material("DriverFabric", (.52,.018,.040), 0,.88)
suit = material("SuitFabric", (.018,.055,.07), 0,.9)
skin = material("SkinTan", (.59,.31,.19), 0,.64)
hair = material("HairInk", (.065,.025,.11), 0,.78)
eye = material("EyeWhite", (.82,.85,.78), 0,.3)
iris = material("EyeIris", (.015,.21,.22), .12,.25)
glow = material("LightCyan", (.005,.48,.62), .25,.26, emission=2.2)
tail = material("TailRed", (.48,.008,.004), 0,.3, emission=1.3)
rubber = material("RaceRubber", (.012,.016,.020), 0,.92)

# Silhouette surfaces get one subdivision level, fine hidden curves get fewer
# longitudinal samples. The accepted high precision study remains intact.
wheel_prefixes = ("Tyre", "ForgedRim", "Hub", "SplitSpoke", "Lug")
for obj in list(bpy.context.scene.objects):
    if obj.name.startswith(wheel_prefixes):
        bpy.data.objects.remove(obj, do_unlink=True)
        continue
    obj["accepted_study_part"] = True
    for modifier in obj.modifiers:
        if modifier.type == "SUBSURF": modifier.levels = modifier.render_levels = 1
        if modifier.type == "BEVEL": modifier.segments = 1
    if obj.type == "CURVE":
        obj.data.resolution_u = 1 if "Coil" in obj.name else 3
        obj.data.bevel_resolution = 0 if "Coil" in obj.name else 1
    if "Sculpted" in obj.name or obj.name == "RearEngineCowl": mat = paint
    elif obj.name == "SweptFrontApron": mat = ivory
    elif "FlyingButtress" in obj.name: mat = ivory
    elif obj.name.startswith("TailLight"): mat = tail
    elif obj.name == "InstrumentScreen": mat = glow
    elif "Seat" in obj.name or "Binnacle" in obj.name or "Diffuser" in obj.name or "Cooling" in obj.name: mat = carbon
    elif obj.name == "ContinuousLowerHull": mat = carbon
    elif obj.name == "ContinuousSteeringWheel" or "ExhaustDark" in obj.name: mat = carbon
    else: mat = alloy
    obj.data.materials.clear()
    obj.data.materials.append(mat)

def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons: face.use_smooth = True
    return obj

def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata([point(v) for v in vertices], [], faces)
    data.update()
    bm=bmesh.new();bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(data);bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat)

def sphere(name, pos, scale, mat, segments=14, rings=7):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=point(pos))
    obj = bpy.context.object
    obj.scale = (scale[0],scale[2],scale[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(obj,name,mat)

def capsule(name, a, b, radius, mat):
    delta=point(b)-point(a)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,location=(point(a)+point(b))/2)
    obj=bpy.context.object
    obj.scale=(radius,radius,delta.length/2+radius*.4)
    obj.rotation_euler=delta.to_track_quat("Z","Y").to_euler()
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(obj,name,mat)

def line(name, points, radius, mat, cyclic=False):
    data=bpy.data.curves.new(name,"CURVE")
    data.dimensions="3D";data.resolution_u=3;data.bevel_depth=radius;data.bevel_resolution=0;data.use_fill_caps=True
    spline=data.splines.new("BEZIER");spline.bezier_points.add(len(points)-1)
    for handle,pos in zip(spline.bezier_points,points):
        handle.co=point(pos);handle.handle_left_type=handle.handle_right_type="AUTO"
    spline.use_cyclic_u=cyclic
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat)
    return obj

def cylinder(name, a, b, radius, mat, segments=12):
    delta=point(b)-point(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments,radius=radius,depth=delta.length,location=(point(a)+point(b))/2)
    obj=bpy.context.object;obj.rotation_euler=delta.to_track_quat("Z","Y").to_euler()
    return finish(obj,name,mat)

# Small original light signatures follow the front lip and side intakes.
for side in (-1,1):
    line(f"ApronRunningLight{side}",[(side*.23,-.09,-1.282),(side*.48,-.07,-1.253),(side*.69,-.035,-1.157)],.008,glow)
    line(f"SideAccent{side}",[(side*.565,.005,-.09),(side*.57,.002,.09),(side*.52,.01,.25)],.008,glow)

# Sculpted original driver is kept separate from the approved vehicle surfaces.
build_character = run_path(str(ROOT / "scripts/kestrel_character.py"))["build_character"]
vehicle_objects = set(bpy.context.scene.objects)
build_character(
    {name: globals()[name] for name in ("skin", "hair", "eye", "iris", "fabric", "suit", "ivory", "alloy", "carbon", "paint", "glow")},
    {name: globals()[name] for name in ("mesh", "sphere", "line", "point")},
)
for obj in set(bpy.context.scene.objects) - vehicle_objects:
    obj["character_part"] = True

def reduce_surface(obj, ratio):
    # Interpolate normals from the smooth source surface after mesh reduction.
    # This preserves the broad paint reflections without extra triangles.
    reference=obj.copy();reference.data=obj.data.copy()
    bpy.context.collection.objects.link(reference)
    bpy.ops.object.select_all(action="DESELECT");obj.select_set(True);bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new("RuntimeSurfaceReduction","DECIMATE");mod.ratio=ratio
    bpy.ops.object.modifier_apply(modifier=mod.name)
    transfer=obj.modifiers.new("PreservedSurfaceNormals","DATA_TRANSFER")
    transfer.object=reference;transfer.use_loop_data=True
    transfer.data_types_loops={"CUSTOM_NORMAL"};transfer.loop_mapping="POLYINTERP_NEAREST"
    bpy.ops.object.modifier_apply(modifier=transfer.name)
    reference_mesh=reference.data
    bpy.data.objects.remove(reference,do_unlink=True)
    bpy.data.meshes.remove(reference_mesh)

def export(name, max_triangles):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH","CURVE"}: obj.select_set(True)
    bpy.context.view_layer.objects.active=next(obj for obj in bpy.context.scene.objects if obj.type=="MESH")
    # Evaluate curves and subdivision first, then simplify mechanical parts.
    bpy.ops.object.convert(target="MESH")
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH" or not obj.get("character_part"): continue
        material_name = obj.data.materials[0].name
        ratio = .45 if material_name == "SkinTan" else .75 if material_name in {"EyeWhite", "EyeIris", "HairInk"} else .55
        reduce_surface(obj, ratio)
        del obj["character_part"]
    for obj in list(bpy.context.scene.objects):
        if obj.type!="MESH" or not obj.get("accepted_study_part"): continue
        reduce_surface(obj,.65 if obj.name.startswith(("Sculpted", "SweptFront")) else .28)
        del obj["accepted_study_part"]
    for mat in list(bpy.data.materials):
        objects=[o for o in bpy.context.scene.objects if o.type=="MESH" and o.data.materials and o.data.materials[0]==mat]
        parents={o.parent for o in objects}
        for parent in parents:
            pieces=[o for o in bpy.context.scene.objects if o.type=="MESH" and o.parent==parent and o.data.materials and o.data.materials[0]==mat]
            if len(pieces)<2: continue
            bpy.ops.object.select_all(action="DESELECT")
            for obj in pieces: obj.select_set(True)
            bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join()
    triangles=0
    for obj in bpy.context.scene.objects:
        if obj.type!="MESH":continue
        obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
    assert triangles<=max_triangles, f"{name}: {triangles} triangles exceeds {max_triangles}"
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/f"{name}.blend"))
    bpy.ops.export_scene.gltf(filepath=str(SOURCE/f"{name}.glb"),export_format="GLB",export_yup=True,export_animations=True)
    bpy.ops.export_scene.gltf(filepath=str(PUBLIC/f"{name}.glb"),export_format="GLB",export_yup=True,export_animations=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
    print(json.dumps({"name":name,"triangles":triangles,"bytes":(PUBLIC/f"{name}.glb").stat().st_size}))

export("kestrel-kart-v2",12000)
# Existing low-quality mode uses a smaller mesh with the same animation rig.
for obj in list(bpy.context.scene.objects):
    if obj.type!="MESH": continue
    mat_name=obj.data.materials[0].name
    reduce_surface(obj,.9 if mat_name in {"SkinTan","EyeWhite","EyeIris","HairInk"} else .44)
export("kestrel-kart-low-v2",8000)

bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
def lathe(name,profile,mat,segments=24):
    vertices=[];faces=[]
    for x,r in profile:
        for j in range(segments):
            a=j*math.tau/segments;vertices.append((x,math.sin(a)*r,math.cos(a)*r))
    for row in range(len(profile)-1):
        for j in range(segments):
            a=row*segments+j;b=row*segments+(j+1)%segments;faces.append((a,b,b+segments,a+segments))
    return mesh(name,vertices,faces,mat)
lathe("RoundedGroovedTyre",[(-.15,.172),(-.151,.23),(-.11,.28),(-.055,.29),(-.045,.285),(-.033,.29),(.033,.29),(.045,.285),(.055,.29),(.11,.28),(.151,.23),(.15,.172)],rubber)
for side in (-1,1):
    lathe(f"Rim{side}",[(side*.125,.13),(side*.140,.145),(side*.148,.172),(side*.143,.184)],alloy,16)
    lathe(f"EnergyRing{side}",[(side*.157,.161),(side*.158,.185)],glow,24)
    cylinder(f"Hub{side}",(side*.128,0,0),(side*.153,0,0),.044,alloy,12)
    for j in range(6):
        angle=j*math.tau/6
        for split in (-1,1):
            vertices=[]
            for radius,a in [(.043,angle),(.171,angle+split*.13)]:
                for offset in (-.008,.008):
                    vertices.append((side*(.13+radius*.06),math.sin(a)*radius+math.cos(a)*offset,math.cos(a)*radius-math.sin(a)*offset))
            mesh(f"Spoke{side}_{j}_{split}",vertices,[(0,1,3,2),(2,3,1,0)],alloy)
export("kestrel-wheel-v1",1000)
