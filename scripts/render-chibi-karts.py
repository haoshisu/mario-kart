"""Photograph the actual runtime meshes; portraits are used by the character picker."""
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'doc/images/chibi-crew';OUT.mkdir(parents=True,exist_ok=True)
PORTRAITS=ROOT/'public/characters';PORTRAITS.mkdir(parents=True,exist_ok=True)
def p(v):return Vector((v[0],-v[2],v[1]))
for character in ('dodo','lumi','lili','bibo'):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'art-source/chibi-karts/chibi-{character}-v1.blend'))
    with bpy.data.libraries.load(str(ROOT/'art-source/kestrel-wheel-v1.blend'),link=False) as (src,dst):dst.objects=src.objects
    for offset in [(-.72,-.14,-.55),(.72,-.14,-.55),(-.72,-.14,.62),(.72,-.14,.62)]:
        for template in dst.objects:
            if template and template.type=='MESH':
                o=template.copy();o.data=template.data;o.location=template.location+p(offset);bpy.context.collection.objects.link(o)
    floor=bpy.data.materials.new('Backdrop');floor.diffuse_color=(.045,.075,.095,1);floor.use_nodes=True
    floor.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.045,.075,.095,1)
    bpy.ops.mesh.primitive_plane_add(size=200,location=p((0,-.435,0)));bpy.context.object.data.materials.append(floor)
    for loc,power,size in [((3,5,-3),750,4),((-3,2,-1),500,3),((1,4,3),900,3)]:
        bpy.ops.object.light_add(type='AREA',location=p(loc));light=bpy.context.object
        light.data.energy=power;light.data.size=size;light.rotation_euler=(p((0,.3,0))-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO'
    scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('Studio world')
    scene.world.color=(.15,.15,.15);scene.view_settings.view_transform='AgX'
    scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.frame_set(1)
    camera.location=p((2.8,1.8,-3.8));camera.rotation_euler=(p((0,.34,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=3.3
    scene.render.resolution_x=800;scene.render.resolution_y=700;scene.render.filepath=str(OUT/f'{character}-kart.png');bpy.ops.render.render(write_still=True)
    camera.location=p((.6,1.03,-2));camera.rotation_euler=(p((0,.88,.23))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=.97
    scene.render.resolution_x=320;scene.render.resolution_y=320;scene.render.filepath=str(PORTRAITS/f'{character}.png');bpy.ops.render.render(write_still=True)
print('CHIBI_PREVIEWS_COMPLETE')
