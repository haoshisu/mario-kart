"""Render the actual original Blender architecture, not an AI concept image."""
import bpy, os, math
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art-source/taiwan-environment-v1.blend'))
for o in list(bpy.context.scene.objects):
 if not o.name.startswith('gate_'):o.hide_render=True
for side in [-1,1]:
 for step in range(3):
  for o in list(bpy.context.scene.objects):
   if not o.name.startswith('arcade_'):continue
   copy=o.copy();copy.data=o.data;bpy.context.collection.objects.link(copy)
   copy.hide_render=False;copy.location=(side*17,-step*10,0);copy.rotation_euler.z=-side*math.pi/2
bpy.ops.mesh.primitive_plane_add(size=180)
plane=bpy.context.object;plane.location.z=-.03;mat=bpy.data.materials.new('PreviewGround');mat.diffuse_color=(.12,.14,.16,1);plane.data.materials.append(mat)
bpy.ops.object.light_add(type='SUN',location=(-20,-40,35));sun=bpy.context.object;sun.rotation_euler=(math.radians(28),math.radians(-30),math.radians(-35));sun.data.energy=2.4;sun.data.angle=.1;sun.data.color=(1,.8,.62)
bpy.ops.object.light_add(type='AREA',location=(0,-22,25));fill=bpy.context.object;fill.data.energy=2400;fill.data.shape='DISK';fill.data.size=30;fill.rotation_euler=(Vector((0,0,8))-fill.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(27,-47,23));camera=bpy.context.object;camera.rotation_euler=(Vector((0,-4,7))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=38;bpy.context.scene.camera=camera
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.world.color=(.22,.27,.35);scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(ROOT,'doc/images/track-redesign/taipei-blender-v1.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art-source/taiwan-architecture-preview.blend'))
bpy.ops.render.render(write_still=True)
