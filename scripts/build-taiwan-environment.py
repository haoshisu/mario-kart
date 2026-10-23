"""Original modular Taiwan architecture. Blender 4.5, metres, no external assets.
Each module exports one joined mesh per material; runtime instances the modules.
"""
import bpy, math, os, json, random, sys
LOW = "--low" in sys.argv
VERSION = "taiwan-environment-low-v1" if LOW else "taiwan-environment-v1"
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
PALETTE={
 'Masonry':('#ac6952',.87,0),'Stone':('#bcae92',.92,0),
 'Timber':('#594734',.82,0),'Roof':('#435659',.72,.12),
 'Metal':('#78918e',.36,.65),'Glass':('#2e6469',.21,.45),
 'Glow':('#ffc47f',.38,0),'Foliage':('#406453',.95,0),
}
def rgb(h):
 a=[int(h[i:i+2],16)/255 for i in (1,3,5)]
 return tuple(v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in a)
materials={}
for name,(h,r,m) in PALETTE.items():
 mat=bpy.data.materials.new(name);mat.use_nodes=True
 p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(1,1,1,1);p.inputs['Roughness'].default_value=r;p.inputs['Metallic'].default_value=m
 vc=mat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Tint';mat.node_tree.links.new(vc.outputs['Color'],p.inputs['Base Color'])
 if name=='Glow':
  mat.node_tree.links.new(vc.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.7
 materials[name]=mat
class Model:
 def __init__(self,name):self.name=name;self.parts={};self.objects=[]
 def face(self,verts,faces,mat='Stone',color=None):
  p=self.parts.setdefault(mat, [[],[],[]]);start=len(p[0]);p[0].extend(verts);p[1].extend([tuple(start+i for i in f) for f in faces]);p[2].extend([rgb(color or PALETTE[mat][0])]*len(faces))
 def box(self,c,s,mat='Stone',color=None):
  x,y,z=c;w,d,h=[v/2 for v in s]
  self.face([(x+a*w,y+b*d,z+c*h) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,color)
 def beam(self,a,b,r=.12,mat='Timber',color=None,n=6,r2=None):
  n=min(n,4) if LOW else n
  a,b=Vector(a),Vector(b);direction=(b-a).normalized();u=direction.cross(Vector((0,0,1)))
  if u.length<.001:u=Vector((1,0,0))
  u.normalize();v=direction.cross(u);verts=[]
  for center,rad in [(a,r),(b,r if r2 is None else r2)]:
   for i in range(n):verts.append(tuple(center+(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n))*rad))
  self.face(verts,[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat,color)
 def arch(self,c,width,rise,depth,thickness=.35,mat='Stone',color=None):
  x,y,z=c;n=8 if LOW else 16;verts=[]
  for yy in [y-depth/2,y+depth/2]:
   for rad in [0,thickness]:
    for i in range(n+1):
     angle=math.pi*i/n;verts.append((x+(width/2+rad)*math.cos(angle),yy,z+(rise+rad)*math.sin(angle)))
  stride=n+1;faces=[]
  for i in range(n):
   faces.extend([(i,i+1,stride+i+1,stride+i),(2*stride+i,3*stride+i,3*stride+i+1,2*stride+i+1),(i,2*stride+i,2*stride+i+1,i+1),(stride+i,stride+i+1,3*stride+i+1,3*stride+i)])
  faces.extend([(0,stride,3*stride,2*stride),(n,2*stride+n,3*stride+n,stride+n)])
  self.face(verts,faces,mat,color)
 def roof(self,z,w,d,color=None):
  # Continuous hipped roof: broad ridge, concave slopes, lifted edge corners.
  xs=[-1,-.5,0,.5,1] if LOW else [-1,-.8,-.55,0,.55,.8,1]
  ys=[-1,-.65,0,.65,1] if LOW else [-1,-.85,-.6,-.3,0,.3,.6,.85,1]
  def height(x,y):
   ay=abs(y);hip=max(0,1-max(0,abs(x)-.55)/.45)
   profile=1.8*(1-ay)**1.25+.38*ay**8
   return z+profile*hip+.25*(abs(x)*ay)**5
  verts=[(x*w/2,y*d/2,height(x,y)) for y in ys for x in xs]
  faces=[];nx=len(xs)
  for j in range(len(ys)-1):
   for i in range(nx-1):
    a=j*nx+i;faces.append((a,a+1,a+1+nx,a+nx))
  self.face(verts,faces,'Roof',color)
  self.beam((-w*.275,0,z+1.84),(w*.275,0,z+1.84),.11,'Roof',color)
  for side in ([] if LOW else [-1,1]):
   for x in range(-int(w/2)+1,int(w/2)):
    for y1,y2 in [(0,.55),(.55,.97)]:
     self.beam((x,side*y1*d/2,height(x/(w/2),y1)+.045),(x,side*y2*d/2,height(x/(w/2),y2)+.045),.055,'Roof',color,n=4)
 def window(self,x,y,z,w=1.4,h=1.9,warm=False,wood=False):
  self.box((x,y+.10,z),(w+.18,.22,h+.18),'Timber' if wood else 'Stone')
  self.box((x,y-.025,z),(w,.06,h),'Glow' if warm else 'Glass')
  for xx in ([0] if LOW else [-w*.5,0,w*.5]):self.box((x+xx,y-.09,z),(.075,.12,h),'Timber' if wood else 'Metal')
  self.box((x,y-.10,z),(w,.12,.09),'Timber' if wood else 'Metal')
  if not LOW:self.box((x,y-.18,z-h*.5-.1),(w+.4,.5,.16),'Stone')
 def finish(self):
  collection=bpy.data.collections.new(self.name);bpy.context.scene.collection.children.link(collection)
  for kind,(verts,faces,colors) in self.parts.items():
   mesh=bpy.data.meshes.new(self.name+'_'+kind);mesh.from_pydata(verts,[],faces);mesh.update()
   tint=mesh.color_attributes.new(name='Tint',type='FLOAT_COLOR',domain='CORNER');uv=mesh.uv_layers.new(name='Metres')
   for poly,color in zip(mesh.polygons,colors):
    axis=max(range(3),key=lambda a:abs(poly.normal[a]));axes=[a for a in range(3) if a!=axis]
    for loop in poly.loop_indices:
     tint.data[loop].color=(*color,1);v=mesh.vertices[mesh.loops[loop].vertex_index].co;uv.data[loop].uv=(v[axes[0]]/3,v[axes[1]]/3)
   obj=bpy.data.objects.new(self.name+'_'+kind,mesh);collection.objects.link(obj);obj.data.materials.append(materials[kind]);self.objects.append(obj)
  return self
models=[]
for style in ['arcade','stucco','tea']:
 m=Model(style);wall='Timber' if style=='tea' else 'Stone' if style=='stucco' else 'Masonry'
 m.box((0,1.4,4.7),(9,5.2,9.4),wall)
 # Deep ground-floor arcade: full open front passage with arched columns.
 for x in [-4.35,-1.45,1.45,4.35]:
  m.box((x,-3.65,1.6),(.45,.62,3.2),'Stone');m.box((x,-3.65,.15),(.72,.85,.3),'Stone')
 for x in [-2.9,0,2.9]:m.arch((x,-3.65,2.5),2.35,.95,.6)
 m.box((0,-2.5,4.0),(9,3,.5),wall)
 # Upper rooms, recessed windows and thick cornices.
 for z in [5.6,8.0]:
  for x in [-2.9,0,2.9]:m.window(x,-1.35,z,1.7,1.8,warm=(x!=0 and z==5.6),wood=style=='tea')
  m.box((0,-1.4,z-1.15),(9,.45,.22),'Stone')
 m.box((0,-2.6,.07),(9,3.5,.14),'Stone')
 if style=='tea':
  for z in [4.25,7.05,9.65]:m.roof(z,10.2,9.2,'#394e45')
  for x in [-3,0,3]:
   m.beam((x,-4,3.55),(x,-4,3),.035,'Metal',n=4)
   # Bulbous lantern, not a spherical floating ball.
   m.beam((x,-4,2.75),(x,-4,3.25),.24,'Glow','#d85c38',n=10,r2=.18)
   m.box((x,-4,3.26),(.27,.27,.09),'Metal','#5b3023');m.beam((x,-4,2.4),(x,-4,2.68),.025,'Glow',n=4)
 else:
  m.box((0,1.3,9.6),(9.5,6,.32),'Stone');m.box((0,-1.6,10.05),(9.3,.4,.7),wall)
  for x in [-4.4,0,4.4]:m.box((x,-1.85,10.25),(.5,.3,1.1),'Stone')
  # Modest baroque pediment relief and ceramic coping.
  m.arch((0,-1.65,10.15),4.5,1.45,.35,.22,'Stone')
  for x in [-3,3]:m.box((x,-1.7,10.35),(1.7,.35,.15),'Stone')
 models.append(m.finish())
# Traversable warehouse/station frame: no wall across the 12 m road opening.
for name in ['warehouse','station']:
 m=Model(name);wood=name=='station';mat='Timber' if wood else 'Metal'
 for x in [-7,7]:
  m.box((x,0,2.3),(.8,14,4.6),'Timber' if wood else 'Masonry')
  for y in [-6.5,0,6.5]:
   m.box((x,y,3.9),(.4,.4,7.8),mat)
   m.beam((x,y,7.8),(0,y,10.4),.14,mat,n=4)
   m.beam((x,y,6.4),(x*.7,y,7.8),.12,mat,n=4)
 for y in [-6.5,0,6.5]:m.beam((-7,y,7.8),(7,y,7.8),.12,mat,n=4)
 m.face([(-8,-8,7.8),(8,-8,7.8),(-8,8,7.8),(8,8,7.8),(0,-8,10.5),(0,8,10.5)],[(0,4,5,2),(4,1,3,5)],'Roof','#4c605b' if wood else '#697b7b')
 for x in [-8,8]:m.box((x,0,7.75),(.25,16,.3),mat)
 for y in [-8,8]:
  for x in [-5,5]:m.window(x,y if y<0 else -1,5.8,2,1.3,True,wood)
 models.append(m.finish())
m=Model('gate')
# A real open masonry vault, 11m wide and 8m high.
for x in [-8.8,8.8]:m.box((x,0,4),(6.1,5.5,8),'Masonry','#a95440');m.box((x,0,.3),(6.5,6,.6),'Stone')
# Spandrel above the opening closes the wall all the way to the upper hall.
verts=[];n=16
for y in [-2.75,2.75]:
 for i in range(n+1):
  angle=math.pi*i/n;verts.extend([(5.65*math.cos(angle),y,3+4.8*math.sin(angle)),(5.65*math.cos(angle),y,9.5)])
faces=[];stride=2*(n+1)
for i in range(n):
 a=i*2;faces.extend([(a,a+1,a+3,a+2),(stride+a+2,stride+a+3,stride+a+1,stride+a),(a,stride+a,stride+a+2,a+2)])
m.face(verts,faces,'Masonry','#a95440')
m.arch((0,0,3.0),11.3,4.8,5.65,.28,'Masonry','#ba6d51')
m.box((0,0,9.1),(23.7,6.4,1.6),'Masonry','#a95440');m.box((0,0,10.15),(24.3,7,.45),'Stone')
m.box((0,0,12.0),(20.2,5.6,3.3),'Masonry','#b95a45')
for x in [-8,-4,0,4,8]:m.window(x,-2.86,12.05,1.3,2,True,True)
m.roof(13.7,25,9,'#43504c');m.roof(11.0,23,8,'#43504c')
for side in [-1,1]:
 m.beam((side*6.3,0,15.55),(side*8,0,16.2),.15,'Roof');m.beam((side*8,0,16.2),(side*9,0,17.1),.11,'Roof')
models.append(m.finish())
m=Model('tower');m.box((0,0,3),(26,26,6),'Stone','#6e8982')
for floor in range(8):
 z=7+floor*8.8;r=10-floor*.65
 m.face([(-r,-r,z),(r,-r,z),(r,r,z),(-r,r,z),(-r*1.12,-r*1.12,z+7.7),(r*1.12,-r*1.12,z+7.7),(r*1.12,r*1.12,z+7.7),(-r*1.12,r*1.12,z+7.7)],[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],'Glass','#458f83')
 for side in [-1,1]:
  for i in ([-.6,0,.6] if LOW else [-.7,-.35,0,.35,.7]):
   m.beam((i*r,side*r,z),(i*r*1.12,side*r*1.12,z+7.7),.055,'Metal',n=4)
   m.beam((side*r,i*r,z),(side*r*1.12,i*r*1.12,z+7.7),.055,'Metal',n=4)
  for h in [2.5,5,7.7]:
   rr=r*(1+.12*h/7.7);m.box((0,side*rr,z+h),(rr*2,.12,.16),'Metal','#8fc5af');m.box((side*rr,0,z+h),(.12,rr*2,.16),'Metal','#8fc5af')
 m.box((0,0,z+7.9),(r*2.28,r*2.28,.3),'Metal','#acbbae')
m.beam((0,0,77),(0,0,92),.65,'Metal',r2=.06,n=8);models.append(m.finish())
m=Model('cedar');rng=random.Random(33)
m.beam((0,0,0),(0,0,16),.95,'Timber','#67513b',r2=.2,n=10)
for i in range(9):
 a=i*math.tau/9;m.beam((0,0,2),(math.cos(a)*3,math.sin(a)*3,.15),.58,'Timber','#67513b',r2=.07,n=6)
for layer in range(4):
 z=7+layer*2.7;r=4.1-layer*.7;verts=[];n=10
 for k,(rad,h) in enumerate([(r*.55,z-.5),(r,z),(r*.65,z+1.3),(.2,z+3.6)]):
  for i in range(n):
   a=math.tau*i/n;rr=rad*(.85+rng.random()*.3);verts.append((math.cos(a)*rr,math.sin(a)*rr,h+rng.random()*.35))
 faces=[(a+i,a+(i+1)%n,a+n+(i+1)%n,a+n+i) for a in range(0,n*3,n) for i in range(n)]
 m.face(verts,faces,'Foliage',['#305647','#3e6550','#4c7258','#547a5e'][layer])
models.append(m.finish())
m=Model('crane')
for x in [-7,7]:
 for y in [-5,5]:m.beam((x,y,0),(x*.7,y*.7,26),.32,'Metal','#bd8053',n=6)
for y in [-3.5,3.5]:
 m.beam((-5,y,26),(15,y,26),.42,'Metal','#bd8053',n=6)
 for x in range(-5,15,3):m.beam((x,y,26),(x+3,y,29),.09,'Metal',n=4);m.beam((x,y,29),(x+3,y,26),.09,'Metal',n=4)
 m.beam((-5,y,29),(15,y,29),.2,'Metal','#bd8053',n=4)
 m.beam((11,y,26),(11,y,7),.035,'Metal',n=4)
m.box((11,0,7),(6,6,.4),'Metal');m.box((-3,0,25),(5,7,3),'Metal');models.append(m.finish())
m=Model('ocean')
# Original undulating harbor roof: hexagonal cell silhouette and structural ribs.
for i in range(5):
 x=(i-2)*6;z=6+math.sin(i*.7)*4
 m.beam((x,0,0),(x,0,z),3.8,'Glass','#568e8e',n=6)
 m.beam((x,0,z),(x,0,z+1.5),4.7,'Stone','#ddd7ba',n=6,r2=4.3)
 for side in [-1,1]:m.beam((x,side*3.5,0),(x,side*4.7,z+1),.12,'Metal','#ebe6d0',n=4)
models.append(m.finish())
os.makedirs(os.path.join(ROOT,'art-source'),exist_ok=True);os.makedirs(os.path.join(ROOT,'public/models'),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art-source',VERSION+'.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models',VERSION+'.glb'),export_format='GLB',export_yup=True,export_materials='EXPORT',export_vertex_color='MATERIAL')
report={m.name:sum(len(p.vertices)-2 for obj in m.objects for p in obj.data.polygons) for m in models}
print('MODULE_TRIANGLES',json.dumps(report));print('ORIGINAL_ENVIRONMENT_EXPORTED')
