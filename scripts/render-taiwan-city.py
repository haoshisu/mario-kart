"""Studio preview of the actual street modules; not a game screenshot."""
import bpy, os, math
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art-source/taiwan-environment-v1.blend'))
for obj in list(bpy.data.objects):
    if obj.type != 'MESH' or not obj.name.startswith(('arcade_','tea_','warehouse_')):bpy.data.objects.remove(obj,do_unlink=True)
with bpy.data.libraries.load(os.path.join(ROOT,'art-source/taiwan-city/taiwan-city-v1.blend')) as (source,target):
    target.objects=list(source.objects)
for obj in target.objects:
    bpy.context.collection.objects.link(obj)
for obj in list(bpy.data.objects):
    if obj.name.startswith(('arcade_','street_')):obj.location.x=-16
    elif obj.name.startswith(('warehouse_','harbor_')):obj.location.x=19
bpy.ops.mesh.primitive_plane_add(size=200)
plane=bpy.context.object;plane.location.z=-.04
mat=bpy.data.materials.new('StudioGround');mat.diffuse_color=(.13,.19,.20,1);plane.data.materials.append(mat)
bpy.ops.object.light_add(type='SUN',location=(-20,-30,30));sun=bpy.context.object
sun.rotation_euler=(.4,-.5,-.4);sun.data.energy=2.1;sun.data.angle=.12
bpy.ops.object.light_add(type='AREA',location=(0,-20,28));fill=bpy.context.object
fill.data.energy=3500;fill.data.shape='DISK';fill.data.size=35
fill.rotation_euler=(Vector((0,0,4))-fill.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(24,-62,29));camera=bpy.context.object
camera.rotation_euler=(Vector((1,-1,4.8))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=58
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.cycles.use_denoising=True;scene.world.color=(.3,.3,.3)
scene.render.resolution_x=1600;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(ROOT,'doc/images/taiwan-city/blender-streets.png')
bpy.ops.render.render(write_still=True)
