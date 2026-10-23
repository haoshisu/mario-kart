"""Render the actual original R2 assets for art review, without game-state changes."""
import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
def p(v):return Vector((v[0],-v[2],v[1]))
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art-source/pulse-kart-v2.blend'))
with bpy.data.libraries.load(str(ROOT/'art-source/pulse-wheel-v2.blend'),link=False) as (source,target):target.objects=source.objects
for offset in [(-.72,-.14,-.55),(.72,-.14,-.55),(-.72,-.14,.62),(.72,-.14,.62)]:
    for template in target.objects:
        if template and template.type=='MESH':
            obj=template.copy();obj.data=template.data;obj.location=template.location+p(offset);bpy.context.collection.objects.link(obj)
bpy.ops.mesh.primitive_plane_add(size=200,location=p((0,-.43,0)))
mat=bpy.data.materials.new('StudioFloor');mat.diffuse_color=(.10,.13,.16,1);mat.use_nodes=True
mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.10,.13,.16,1)
mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.5
bpy.context.object.data.materials.append(mat)
for location,power,size in [((3,5,-2),1000,5),((-3,2,-1),700,3),((1,3,3),1100,3)]:
    bpy.ops.object.light_add(type='AREA',location=p(location));lamp=bpy.context.object;lamp.data.energy=power;lamp.data.shape='DISK';lamp.data.size=size
    lamp.rotation_euler=(p((0,.35,0))-lamp.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=p((2.6,1.8,-3.1)));camera=bpy.context.object
camera.rotation_euler=(p((0,.35,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=52;bpy.context.scene.camera=camera
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world.color=(.12,.14,.18);scene.render.resolution_x=1024;scene.render.resolution_y=768;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'doc/images/pulse-r2.png')
Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
scene.frame_set(1);bpy.ops.render.render(write_still=True)
