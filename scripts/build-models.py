"""Original Kart Lab assets. Run with Blender 4.5 --background --python.

Coordinates are authored in game XYZ and mapped to Blender Z-up; the glTF
exporter restores game Y-up. No downloaded meshes, textures or animation.
"""
import bpy
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
bpy.context.preferences.filepaths.save_version = 0
OUT = ROOT / "public" / "models"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / "art-source"
SOURCE.mkdir(parents=True, exist_ok=True)

def position(p):
    return (p[0], -p[2], p[1])

def material(name, color, metallic=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = 0.55
    return m

def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    return obj

def box(name, p, size, mat, bevel=0.06):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position(p))
    obj = bpy.context.object
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("SoftEdges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish(obj, name, mat)

def sphere(name, p, size, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, location=position(p))
    obj = bpy.context.object
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return finish(obj, name, mat)

def cylinder(name, p, radius, depth, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=depth,
                                     location=position(p), rotation=(0, math.pi / 2, 0))
    return finish(bpy.context.object, name, mat)

def export(name):
    # Batch static pieces by material while retaining separately animated hands.
    for mat in bpy.data.materials:
        pieces = [o for o in bpy.context.scene.objects if o.type == "MESH"
                  and not o.animation_data and o.data.materials and o.data.materials[0] == mat]
        if len(pieces) > 1:
            bpy.ops.object.select_all(action="DESELECT")
            for obj in pieces:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = pieces[0]
            bpy.ops.object.join()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / f"{name}.blend"))
    bpy.ops.export_scene.gltf(filepath=str(SOURCE / f"{name}.glb"), export_format="GLB",
                             export_animations=True, export_yup=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / f"{name}.glb"), export_format="GLB",
                             export_animations=True, export_yup=True,
                             export_draco_mesh_compression_enable=True,
                             export_draco_mesh_compression_level=6)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
paint = material("PlayerPaint", (0.85, 0.15, 0.07))
white = material("Ivory", (0.91, 0.92, 0.83))
dark = material("Graphite", (0.025, 0.045, 0.06))
metal = material("Alloy", (0.38, 0.47, 0.52), 0.65)
glass = material("Visor", (0.015, 0.20, 0.27), 0.3)
light = material("Amber", (1, 0.46, 0.035))
box("Chassis", (0, -0.04, 0.06), (1.22, 0.27, 1.7), dark)
sphere("Nose", (0, 0.05, -0.59), (0.60, 0.30, 0.43), paint)
box("NoseStripe", (0, 0.215, -0.64), (0.18, 0.04, 0.40), white, 0.015)
for side in (-1, 1):
    sphere(f"SidePod{side}", (side * 0.49, 0.06, 0.18), (0.24, 0.25, 0.67), paint)
    box(f"SideBlade{side}", (side * 0.57, 0.11, 0.14), (0.09, 0.06, 0.57), white, 0.02)
    box(f"RearLamp{side}", (side * 0.4, 0.16, 0.85), (0.24, 0.12, 0.055), light, 0.02)
    box(f"Exhaust{side}", (side * 0.31, -0.08, 0.91), (0.16, 0.16, 0.24), metal, 0.04)
box("Bumper", (0, -0.12, -0.9), (1.15, 0.12, 0.11), metal, 0.04)
box("Seat", (0, 0.25, 0.36), (0.6, 0.54, 0.28), dark)
# Pip: an original fox aviator with an oversized, readable silhouette.
fur = material("ApricotFur", (0.95, 0.43, 0.10))
sphere("PilotSuit", (0, 0.44, 0.14), (0.32, 0.36, 0.27), paint)
sphere("Scarf", (0, 0.70, 0.12), (0.34, 0.09, 0.29), white)
sphere("PipHead", (0, 1.02, 0.09), (0.46, 0.40, 0.36), fur)
for side in (-1, 1):
    sphere(f"Ear{side}", (side * 0.31, 1.39, 0.10), (0.15, 0.28, 0.13), fur)
    sphere(f"InnerEar{side}", (side * 0.31, 1.40, -0.005), (0.08, 0.17, 0.035), white)
    sphere(f"Cheek{side}", (side * 0.17, 0.91, -0.23), (0.23, 0.17, 0.16), white)
    sphere(f"Eye{side}", (side * 0.17, 1.10, -0.225), (0.12, 0.16, 0.085), white)
    sphere(f"Pupil{side}", (side * 0.17, 1.10, -0.30), (0.058, 0.095, 0.035), dark)
    sphere(f"EyeGlint{side}", (side * 0.17 - 0.018, 1.135, -0.33), (0.021, 0.03, 0.014), white)
sphere("NoseTip", (0, 0.96, -0.39), (0.085, 0.065, 0.055), dark)
box("AviatorBand", (0, 1.25, -0.19), (0.65, 0.09, 0.12), paint)
for side in (-1, 1):
    sphere(f"GoggleRim{side}", (side * 0.17, 1.30, -0.20), (0.15, 0.11, 0.07), metal)
    sphere(f"GoggleLens{side}", (side * 0.17, 1.30, -0.255), (0.115, 0.075, 0.035), glass)
    box(f"SpoilerMount{side}", (side * 0.40, 0.32, 0.73), (0.08, 0.37, 0.10), metal)
box("RearWing", (0, 0.50, 0.76), (1.30, 0.13, 0.29), paint)
box("WingStripe", (0, 0.573, 0.76), (0.27, 0.018, 0.27), white, 0.005)
for side in (-1, 1):
    hand = sphere(f"Glove{side}", (side * 0.28, 0.42, -0.19), (0.12, 0.12, 0.13), white)
    original = hand.location.copy()
    for frame, height in ((1, 0), (12, 0.38), (24, 0.26), (36, 0.38), (48, 0)):
        hand.location = original.copy()
        hand.location.z += height
        hand.keyframe_insert(data_path="location", frame=frame)
    hand.animation_data.action.name = f"Victory{side}"
    hand.location = original
box("Dashboard", (0, 0.31, -0.27), (0.46, 0.10, 0.19), dark)
bpy.context.scene.frame_set(1)
export("pulse-kart-v1")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
cylinder("Tire", (0, 0, 0), 0.29, 0.24, dark)
for side in (-1, 1):
    cylinder(f"Rim{side}", (side * 0.125, 0, 0), 0.18, 0.012, metal)
    cylinder(f"Hub{side}", (side * 0.135, 0, 0), 0.07, 0.02, white)
    for spoke in range(5):
        angle = spoke * math.tau / 5
        box(f"Spoke{side}_{spoke}", (side * 0.14, math.sin(angle) * 0.105, math.cos(angle) * 0.105),
            (0.025, 0.065, 0.065), white, 0)
export("pulse-wheel-v1")
