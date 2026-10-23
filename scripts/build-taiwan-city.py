"""Original Taiwan street dressing, in metres; Blender Z-up to glTF Y-up.
Run Blender --background --python scripts/build-taiwan-city.py [-- --low].
The kit fits existing street/tea/warehouse footprints; no external models/textures.
"""
import bpy, math, os, sys, json
from mathutils import Vector
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOW = '--low' in sys.argv
NAME = 'taiwan-city-low-v1' if LOW else 'taiwan-city-v1'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
font = bpy.data.fonts.load('/System/Library/Fonts/STHeiti Light.ttc')
materials = {}
for name in ['CityPaint', 'CityLight']:
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    nodes = mat.node_tree.nodes; shader = nodes.get('Principled BSDF')
    color = nodes.new('ShaderNodeVertexColor'); color.layer_name = 'Tint'
    mat.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])
    shader.inputs['Roughness'].default_value = .72
    if name == 'CityLight':
        mat.node_tree.links.new(color.outputs['Color'], shader.inputs['Emission Color'])
        shader.inputs['Emission Strength'].default_value = .55
    materials[name] = mat

def linear(hex):
    values = [int(hex[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in values) + (1,)

class Kit:
    def __init__(self, name):
        self.name = name; self.parts = {key: [] for key in materials}
    def add(self, obj, color, glow=False):
        mat = 'CityLight' if glow else 'CityPaint'
        obj.data.materials.clear(); obj.data.materials.append(materials[mat])
        tint = obj.data.color_attributes.new(name='Tint',type='FLOAT_COLOR',domain='CORNER')
        for item in tint.data: item.color = linear(color)
        self.parts[mat].append(obj)
    def box(self, p, s, color, glow=False):
        bpy.ops.mesh.primitive_cube_add(size=1, location=p)
        obj=bpy.context.object; obj.scale=s
        self.add(obj,color,glow)
    def rod(self,a,b,r,color,r2=None,n=8,glow=False):
        a,b=Vector(a),Vector(b); d=b-a
        bpy.ops.mesh.primitive_cone_add(vertices=6 if LOW else n,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(a+b)/2)
        obj=bpy.context.object; obj.rotation_euler=d.to_track_quat('Z','Y').to_euler()
        self.add(obj,color,glow)
    def text(self,label,p,size,color):
        curve=bpy.data.curves.new('Lettering','FONT'); curve.body=label; curve.font=font
        curve.size=size; curve.align_x='CENTER'; curve.align_y='CENTER'; curve.extrude=0 if LOW else .008; curve.resolution_u=1
        obj=bpy.data.objects.new('Lettering',curve); bpy.context.collection.objects.link(obj)
        obj.location=p; obj.rotation_euler=(math.pi/2,0,0)
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.convert(target='MESH'); self.add(bpy.context.object,color,True)
    def tank(self,x,y,z):
        for dx in [-.5,.5]: self.box((x+dx,y,z+.24),(.13,1.1,.48),'#52646a')
        self.rod((x,y,z+.5),(x,y,z+2),.73,'#b6c9c8',n=12)
        for h in [.5,1.25,2]: self.rod((x,y,z+h-.035),(x,y,z+h+.035),.78,'#e2e5cd',n=12)
        self.rod((x,y,z+2),(x,y,z+2.18),.73,'#a6bcb9',r2=.22,n=12)
        self.rod((x+.88,y,z+.3),(x+.88,y,z+1.8),.045,'#758f91')
    def finish(self):
        for material,objects in self.parts.items():
            if not objects: continue
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects: obj.select_set(True)
            bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
            obj=bpy.context.object;obj.name=self.name+'_'+material
            bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)

m=Kit('street')
# Recessed storefronts behind the open arcade, not across its walking passage.
for i,x in enumerate([-2.9,0,2.9]):
    col=['#c96b42','#247f77','#496c99'][i]
    m.box((x,-1.3,1.65),(2.45,.12,2.85),'#193b42')
    for dx in [-1.1,0,1.1]:m.box((x+dx,-1.4,1.65),(.07,.12,2.85),'#d2d8c3')
    m.box((x,-1.44,1),(2.4,.12,.14),col)
    m.box((x,-3.97,3.9),(2.65,.22,.75),col)
    m.text(['豆花','茶行','小食'][i],(x,-4.1,3.9),.52,'#fff0c0')
    # Shallow pitched fabric awnings, fascia and alternating stripes.
    for stripe in range(6):
        m.box((x-1.1+stripe*.44,-2.03,3.32),(.44,1.4,.12),col if stripe%2 else '#e9dec0')
    if not LOW:
        m.box((x+.62,-1.75,6.55),(.8,.55,.56),'#d9d9c7')
        m.rod((x+.62,-2.04,6.55),(x+.62,-2.08,6.55),.2,'#64797c')
        for h in [5,7.4]:
            m.box((x,-2.1,h),(2.2,1.25,.13),'#b5c1af')
            m.rod((x-1,-2.65,h+.65),(x+1,-2.65,h+.65),.035,'#395e5b')
            for dx in [-1,-.5,0,.5,1]:m.rod((x+dx,-2.65,h),(x+dx,-2.65,h+.65),.028,'#395e5b')
# Projecting vertical lightbox and rooftop water tank are visible in silhouette.
m.box((4,-3.45,6.2),(.82,.32,3.3),'#be4e49')
for i,char in enumerate('夜市街'):m.text(char,(4,-3.63,7.15-i*.94),.67,'#ffe5a4')
m.tank(2,1,9.8)
m.box((-1.6,1.3,10.35),(3.2,3.6,1.1),'#538f83')
m.box((-1.6,1.3,10.98),(3.6,3.9,.16),'#adc3b0')
if not LOW:
    for x in [-3,-1,1]:
        m.box((x,-2.15,5.12),(.6,.35,.3),'#b66c4d')
        for dx in [-.18,.18]:m.rod((x+dx,-2.15,5.25),(x+dx,-2.15,5.7),.17,'#5d986a',r2=.08)
m.finish()

m=Kit('tea')
m.box((0,-4.38,4.7),(3.6,.18,.85),'#614636')
m.text('山城茶屋',(0,-4.49,4.7),.62,'#ffe0a0')
# Lantern chains hang outside the arcade roof; retained in the low mesh.
for x in [-3.8,3.8]:
    m.rod((x,-4.25,3.8),(x,-4.25,7.8),.025,'#614a34')
    for z in [4.2,5.45,6.7]:
        m.rod((x,-4.25,z-.3),(x,-4.25,z),.25,'#d85137',r2=.37,n=10,glow=True)
        m.rod((x,-4.25,z),(x,-4.25,z+.3),.37,'#e7653b',r2=.25,n=10,glow=True)
        for h in [-.32,.32]:m.rod((x,-4.25,z+h-.04),(x,-4.25,z+h+.04),.25,'#d4a557')
        m.rod((x,-4.25,z-.55),(x,-4.25,z-.35),.04,'#eeb95b')
for x in [-2.8,0,2.8]:
    m.box((x,-1.35,1.65),(2.35,.18,2.9),'#2b4940')
    for dx in [-1,0,1]:m.box((x+dx,-1.5,1.65),(.09,.1,2.9),'#b68b55')
    if not LOW:
        m.rod((x,-2.3,0),(x,-2.3,1),.1,'#543f2e')
        m.rod((x,-2.3,.95),(x,-2.3,1.12),.6,'#966e48',n=12)
        m.rod((x,-2.3,1.13),(x,-2.3,1.4),.14,'#719a80',r2=.1)
        for dx in [-.9,.9]:
            m.box((x+dx,-2.3,.52),(.48,.48,.15),'#976d44')
            for dy in [-.17,.17]:m.box((x+dx,-2.3+dy,.25),(.1,.1,.5),'#725539')
m.finish()

m=Kit('harbor')
# A pop-up port shop in front of the side warehouse, within its original envelope.
for x in [-4.2,4.2]:
    col='#247e88' if x<0 else '#cc714e'
    m.box((x,-7.6,1.25),(3.7,1.15,2.5),col)
    m.box((x,-8.2,1.45),(3.15,.08,1.3),'#294950')
    m.box((x,-8.35,.8),(3.5,.65,.14),'#e7c28d')
    m.box((x,-7.9,2.65),(4.1,1.8,.22),'#e7d9b1')
    m.box((x,-8.22,2.26),(3.4,.16,.52),col)
    m.text('海風冰室' if x<0 else '港邊商行',(x,-8.32,2.26),.4,'#fff1bf')
    if not LOW:
        for dx in [-1,0,1]:
            m.rod((x+dx,-8.65,0),(x+dx,-8.65,.55),.05,'#617a79')
            m.rod((x+dx,-8.65,.55),(x+dx,-8.65,.66),.23,'#dcaf72')
        for z in [3.8,5.3,6.8]:m.box((x,-7.15,z),(2.6,.2,.16),col)
m.box((0,-8.08,8.7),(8,.18,1.1),'#286573')
m.text('海風倉庫',(0,-8.2,8.7),.8,'#ffe4a5')
m.finish()

out=os.path.join(ROOT,'art-source/taiwan-city');os.makedirs(out,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,NAME+'.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models',NAME+'.glb'),export_format='GLB',export_yup=True,export_vertex_color='MATERIAL')
report={o.name:sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.data.objects if o.type=='MESH'}
with open(os.path.join(out,NAME+'.json'),'w') as f:json.dump(report,f,indent=2)
print('CITY_KIT_EXPORTED',json.dumps(report))
