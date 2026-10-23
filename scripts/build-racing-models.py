"""Original Pulse R2 / Aster helmeted racer, Blender 4.5 background build.
Game XYZ -> Blender Z-up -> embedded, Draco-compressed glTF. No imported assets.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-source'
OUT = ROOT / 'public/models'
bpy.context.preferences.filepaths.save_version = 0

def p(v): return Vector((v[0], -v[2], v[1]))
def material(name, color, metal=0, rough=.5, coat=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Metallic'].default_value=metal
    shader.inputs['Roughness'].default_value=rough
    shader.inputs['Coat Weight'].default_value=coat
    return m

def finish(obj,name,mat):
    obj.name=name; obj.data.materials.append(mat)
    return obj

def smooth(obj):
    for face in obj.data.polygons: face.use_smooth=True
    return obj

def box(name, pos, size, mat, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p(pos)); obj=bpy.context.object
    obj.scale=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=obj.modifiers.new('MachinedEdge','BEVEL');mod.width=bevel;mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=obj.modifiers.new('WeightedNormals','WEIGHTED_NORMAL');mod.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj,name,mat)

def sphere(name,pos,size,mat,segments=20,rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=p(pos));obj=bpy.context.object
    obj.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(smooth(obj),name,mat)

def mesh(name,vertices,faces,mat):
    data=bpy.data.meshes.new(name);data.from_pydata([p(v) for v in vertices],[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    return finish(obj,name,mat)

def tube(name,a,b,radius,mat,segments=12):
    a=p(a);b=p(b);d=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments,radius=radius,depth=d.length,location=(a+b)/2)
    obj=bpy.context.object;obj.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return finish(smooth(obj),name,mat)

def panel(name,sections,mat,x=0):
    vertices=[]
    for z,width,low,high in sections:
        vertices.extend([(x-width,low,z),(x+width,low,z),(x+width*.94,high,z),(x-width*.94,high,z)])
    faces=[(3,2,1,0)]
    for i in range(len(sections)-1):
        for j in range(4): faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
    faces.append(tuple(range(len(vertices)-4,len(vertices))))
    obj=mesh(name,vertices,faces,mat)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    mod=obj.modifiers.new('PanelFillet','BEVEL');mod.width=.024;mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=obj.modifiers.new('PanelNormals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False);return obj

def export(name):
    # One draw per material/animated parent; keep wheel spin owned by the game.
    for mat in list(bpy.data.materials):
        parents={o.parent for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat}
        for parent in parents:
            pieces=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials and o.data.materials[0]==mat]
            if len(pieces)>1:
                bpy.ops.object.select_all(action='DESELECT')
                for obj in pieces:obj.select_set(True)
                bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join()
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/f'{name}.blend'))
    bpy.ops.export_scene.gltf(filepath=str(SOURCE/f'{name}.glb'),export_format='GLB',export_animations=True,export_yup=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{name}.glb'),export_format='GLB',export_animations=True,export_yup=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
paint=material('PlayerPaint',(.55,.035,.025),.45,.26,.7)
white=material('CeramicWhite',(.76,.79,.81),.12,.32,.3)
dark=material('CarbonComposite',(.022,.028,.033),.18,.48)
metal=material('BrushedAlloy',(.35,.40,.45),.85,.25)
rubber=material('RaceRubber',(.016,.019,.021),0,.91)
fabric=material('DriverFabric',(.55,.035,.025),0,.88)
suit=material('SuitFabric',(.075,.09,.105),0,.9)
visor=material('SmokedVisor',(.01,.025,.035),.6,.11,.7)
red=material('RearReflector',(.52,.006,.003),.08,.25)
box('CarbonFloor',(0,-.12,.03),(1.11,.09,1.62),dark)
panel('AerodynamicNose',[(-.98,.40,-.10,-.015),(-.83,.57,-.08,.12),(-.56,.48,-.04,.21),(-.32,.25,.035,.23)],paint)
panel('CentreStripe',[(-.94,.045,-.001,.013),(-.83,.052,.127,.14),(-.56,.049,.214,.225),(-.36,.043,.237,.244)],white)
for side in (-1,1):
    panel(f'SidePod{side}',[(-.28,.14,-.08,.12),(-.04,.16,-.09,.19),(.40,.16,-.09,.13),(.73,.12,-.09,.06)],paint,side*.48)
    tube(f'FrameRail{side}',(side*.56,-.14,-.77),(side*.56,-.14,.80),.024,metal)
    tube(f'RearBrace{side}',(side*.44,-.08,.8),(side*.30,.36,.46),.021,metal)
    box(f'PodIntake{side}',(side*.59,.105,.14),(.04,.12,.34),dark,.009)
    box(f'SideGraphic{side}',(side*.644,.026,.43),(.008,.055,.24),white,.004)
    box(f'RearReflector{side}',(side*.44,.075,.81),(.15,.04,.03),red,.008)
    tube(f'WingStay{side}',(side*.40,.02,.73),(side*.40,.27,.81),.018,metal)
    box(f'WingEndplate{side}',(side*.62,.32,.81),(.024,.14,.25),dark,.008)
tube('FrontBumper',(-.55,-.15,-.99),(.55,-.15,-.99),.027,metal)
tube('RearAxle',(-.73,-.14,.62),(.73,-.14,.62),.025,metal)
box('CompactRearWing',(0,.31,.81),(1.24,.05,.23),paint,.018)
box('WingTrim',(0,.341,.82),(.18,.005,.21),white,.003)
box('EngineBlock',(.31,.17,.60),(.25,.30,.27),dark,.03)
for i in range(5):box(f'CoolingFin{i}',(.31,.08+i*.045,.60),(.29,.015,.29),metal,.003)
tube('ExhaustHeader',(.37,.18,.71),(.45,.14,.91),.045,metal)
tube('Muffler',(.45,.14,.82),(.45,.14,.99),.07,dark)
box('BucketSeat',(0,.10,.31),(.49,.17,.45),dark,.045)
back=box('SeatBack',(0,.40,.47),(.50,.57,.12),dark,.04);back.rotation_euler.x=math.radians(-12)
sphere('SeatedHip',(0,.22,.16),(.20,.15,.20),suit,16,8)
sphere('RacerTorso',(0,.51,.23),(.235,.28,.18),fabric)
box('SuitBackPanel',(0,.55,.397),(.24,.26,.012),suit,.022)
for side in (-1,1):
    tube(f'Thigh{side}',(side*.13,.25,.13),(side*.15,.15,-.22),.09,suit)
    tube(f'Shin{side}',(side*.15,.15,-.22),(side*.17,-.025,-.51),.065,suit)
    box(f'Boot{side}',(side*.17,-.04,-.55),(.135,.11,.23),dark,.025)
sphere('HelmetShell',(0,.94,.23),(.21,.245,.235),white,32,16)
# Opaque curved visor; reflection gives depth without transmission overdraw.
verts=[];faces=[]
for row in range(3):
    vertical=(row-1)*.062
    for j in range(17):
        angle=-1.18+j*2.36/16
        verts.append((math.sin(angle)*.213,.97+vertical,.23-math.cos(angle)*.243))
for row in range(2):
    for j in range(16):
        a=row*17+j;faces.append((a,a+1,a+18,a+17))
smooth(mesh('CurvedVisor',verts,faces,visor))
box('ChinVent',(0,.827,-.004),(.12,.03,.018),dark,.005)
for side in (-1,1):
    sphere(f'VisorPivot{side}',(side*.21,.96,.15),(.015,.026,.025),metal)
    bpy.ops.object.empty_add(type='PLAIN_AXES',location=p((side*.20,.66,.21)));arm=bpy.context.object;arm.name=f'RacerArm{side}'
    pieces=[tube(f'UpperArm{side}',(side*.22,.64,.19),(side*.29,.43,-.03),.062,fabric),tube(f'Forearm{side}',(side*.29,.43,-.03),(side*.22,.34,-.24),.057,suit),sphere(f'Glove{side}',(side*.22,.34,-.24),(.072,.067,.073),dark,12,6)]
    for child in pieces:child.parent=arm;child.matrix_parent_inverse=arm.matrix_world.inverted()
    for frame,angle in ((1,0),(14,side*.7),(28,side*.5),(42,side*.7),(55,0)):
        arm.rotation_euler.y=angle;arm.keyframe_insert(data_path='rotation_euler',frame=frame)
    arm.animation_data.action.name=f'Victory{side}'
    arm.rotation_euler.y=0
# Steering rim lives between hands, angled toward the driver.
rim=[];faces=[]
for j in range(40):
    angle=j*math.tau/40
    for k in range(8):
        cross=k*math.tau/8
        radius=.17+math.cos(cross)*.017
        rim.append((math.cos(angle)*radius,.35+math.sin(angle)*radius*.71+math.sin(cross)*.009,-.27+math.sin(angle)*radius*.41-math.sin(cross)*.015))
for j in range(40):
    for k in range(8):faces.append((j*8+k,((j+1)%40)*8+k,((j+1)%40)*8+(k+1)%8,j*8+(k+1)%8))
smooth(mesh('ContinuousSteeringRim',rim,faces,dark))
for side in (-1,1):tube(f'SteeringSpoke{side}',(0,.35,-.27),(side*.15,.35,-.27),.012,metal,8)
tube('SteeringColumn',(0,.17,-.39),(0,.35,-.27),.015,metal)
export('pulse-kart-v2')

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
verts=[];faces=[];profile=[(-.13,.16),(-.133,.23),(-.105,.285),(-.07,.29),(.07,.29),(.105,.285),(.133,.23),(.13,.16)]
for x,r in profile:
    for j in range(24):
        a=j*math.tau/24;verts.append((x,math.sin(a)*r,math.cos(a)*r))
for i in range(len(profile)-1):
    for j in range(24):
        a=i*24+j;b=i*24+(j+1)%24;faces.append((a,b,b+24,a+24))
smooth(mesh('RoundedRaceSlick',verts,faces,rubber))
for side in (-1,1):
    for j in range(5):
        a=j*math.tau/5
        spoke=box(f'AlloySpoke{side}_{j}',(side*.124,math.sin(a)*.083,math.cos(a)*.083),(.022,.042,.145),metal,0)
        spoke.rotation_euler.x=-a
    tube(f'WheelHub{side}',(side*.105,0,0),(side*.14,0,0),.056,metal,16)
    ring=[];faces=[]
    for j in range(24):
        a=j*math.tau/24
        for radius in (.161,.184):ring.append((side*.125,math.sin(a)*radius,math.cos(a)*radius))
    for j in range(24):faces.append((j*2,((j+1)%24)*2,((j+1)%24)*2+1,j*2+1))
    smooth(mesh(f'RimLip{side}',ring,faces,metal))
export('pulse-wheel-v2')
