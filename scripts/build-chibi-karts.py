"""Build the approved Dodo chibi and three original friends on Kestrel.

Blender 4.5 LTS. Source Dodo study is retained; runtime meshes are seated,
material-batched and reduced, with rigid arm pivots for the Victory clips.
"""
from pathlib import Path
import math
import json
import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-source/chibi-karts'
PUBLIC = ROOT / 'public/models'
SOURCE.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
CHARACTERS = {
    'dodo': ((.018,.34,.32), (.95,.23,.055), (.065,.027,.020), (.86,.49,.31)),
    'lumi': ((.29,.10,.53), (.12,.72,.55), (.105,.035,.17), (.79,.40,.24)),
    'lili': ((.10,.32,.12), (.92,.57,.08), (.28,.07,.012), (.91,.31,.055)),
    'bibo': ((.035,.28,.65), (.95,.55,.06), (.045,.12,.22), (.25,.55,.73)),
}
def p(v): return Vector((v[0],-v[2],v[1]))
def mat(name, color, rough=.55, metallic=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    n=m.node_tree.nodes['Principled BSDF'];n.inputs['Base Color'].default_value=(*color,1)
    n.inputs['Roughness'].default_value=rough;n.inputs['Metallic'].default_value=metallic
    return m

def sphere(name, loc, scale, material, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    for f in o.data.polygons:f.use_smooth=True
    return o

def limb(name,a,b,radius,material):
    a,b=p(a),p(b)
    o=sphere(name,(a+b)/2,(radius,radius,(b-a).length/2+radius*.4),material,16,8)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o

def cone(name, loc, radius, depth, material):
    bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=radius,radius2=.025,depth=depth,location=loc)
    o=bpy.context.object;o.name=name;o.data.materials.append(material)
    bevel=o.modifiers.new('Soft ear tips','BEVEL');bevel.width=.025;bevel.segments=2
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for f in o.data.polygons:f.use_smooth=True
    return o

def reduce(o,ratio):
    if len(o.data.polygons)<24:return
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    reference=o.copy();reference.data=o.data.copy();bpy.context.collection.objects.link(reference)
    mod=o.modifiers.new('Runtime reduction','DECIMATE');mod.ratio=ratio
    bpy.ops.object.modifier_apply(modifier=mod.name)
    normals=o.modifiers.new('Retain smooth shading','DATA_TRANSFER');normals.object=reference
    normals.use_loop_data=True;normals.data_types_loops={'CUSTOM_NORMAL'};normals.loop_mapping='POLYINTERP_NEAREST'
    bpy.ops.object.modifier_apply(modifier=normals.name)
    mesh=reference.data;bpy.data.objects.remove(reference,do_unlink=True);bpy.data.meshes.remove(mesh)

def batch():
    for material in list(bpy.data.materials):
        objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==material]
        groups={}
        for o in objects:groups.setdefault(o.parent,[]).append(o)
        for pieces in groups.values():
            if len(pieces)<2:continue
            bpy.ops.object.select_all(action='DESELECT')
            for o in pieces:o.select_set(True)
            bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join()

def export(character,low=False):
    name=f'chibi-{character}{"-low" if low else ""}-v1'
    bpy.context.scene.frame_set(1)
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    triangles=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in objects)
    materials={m for o in objects for m in o.data.materials}
    assert triangles <= (8000 if low else 12000),(name,triangles)
    assert len(materials)<=12,(name,len(materials))
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/f'{name}.blend'))
    bpy.ops.export_scene.gltf(filepath=str(SOURCE/f'{name}.glb'),export_format='GLB',export_yup=True,export_animations=True)
    bpy.ops.export_scene.gltf(filepath=str(PUBLIC/f'{name}.glb'),export_format='GLB',export_yup=True,export_animations=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
    result={'name':name,'triangles':triangles,'materials':len(materials),'bytes':(PUBLIC/f'{name}.glb').stat().st_size}
    assert result['bytes']<1048576
    return result

metrics=[]
for character,(suit_color,accent_color,hair_color,skin_color) in CHARACTERS.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    paint=mat('PlayerPaint',(.52,.018,.04),.24,.45)
    ivory=mat('CeramicIvory',(.88,.81,.65),.48)
    carbon=mat('CarbonComposite',(.012,.022,.035),.6)
    alloy=mat('BrushedAlloy',(.48,.53,.58),.25,.8)
    glow=mat('LightCyan',(.005,.48,.62),.25)
    glow.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(.005,.48,.62,1)
    glow.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=1.2
    tail=mat('TailRed',(.5,.008,.004),.3)
    suit=mat('CharacterSuit',suit_color,.65);accent=mat('CharacterAccent',accent_color,.55)
    hair=mat('CharacterHair',hair_color,.65);skin=mat('CharacterSkin',skin_color,.65)
    amber=mat('AmberLens',(.48,.22,.025),.3,.4)
    blush=mat('CharacterBlush',(.9,.25,.18),.7)
    with bpy.data.libraries.load(str(ROOT/'art-source/kestrel-study/kestrel-clay.blend'),link=False) as (src,dst):
        dst.objects=src.objects
    for o in dst.objects:
        if o is None:continue
        if o.type not in {'MESH','CURVE'} or o.name.startswith(('Tyre','ForgedRim','Hub','SplitSpoke','Lug')):
            bpy.data.objects.remove(o,do_unlink=True);continue
        bpy.context.collection.objects.link(o)
        for mod in o.modifiers:
            if mod.type=='SUBSURF':mod.levels=mod.render_levels=1
            if mod.type=='BEVEL':mod.segments=1
        if o.type=='CURVE':o.data.resolution_u=1 if 'Coil' in o.name else 3;o.data.bevel_resolution=0 if 'Coil' in o.name else 1
        name=o.name
        if 'Sculpted' in name or name=='RearEngineCowl':material=paint
        elif name=='SweptFrontApron' or 'FlyingButtress' in name:material=ivory
        elif name.startswith('TailLight'):material=tail
        elif name=='InstrumentScreen':material=glow
        elif any(t in name for t in ('Seat','Binnacle','Diffuser','Cooling','ExhaustDark')) or name in ('ContinuousLowerHull','ContinuousSteeringWheel'):material=carbon
        else:material=alloy
        o.data.materials.clear();o.data.materials.append(material)
    bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    bpy.ops.object.convert(target='MESH')
    for o in list(bpy.context.scene.objects):reduce(o,.29 if o.name.startswith(('Sculpted','SweptFront')) else .19)
    vehicle=set(bpy.context.scene.objects)
    with bpy.data.libraries.load(str(ROOT/'art-source/dodo-racer-q-v2/dodo-racer-q-v2.blend'),link=False) as (src,dst):dst.objects=src.objects
    removable=('boot','toe guard','trouser','sleeve','shoulder cap','forearm','cuff','glove','thumb')
    mapping={'Warm peach':skin,'Lagoon suit':suit,'Ivory panels':ivory,'Tangerine accent':accent,'Midnight rubber':carbon,'Espresso hair':hair,'Eye white':ivory,'Pupils':carbon,'Amber goggle lenses':amber,'Brushed brass':alloy,'Peach blush':blush}
    for o in dst.objects:
        if o is None:continue
        name=o.name.lower()
        remove=o.type!='MESH' or o.name in {'Studio floor','Display plinth'} or any(n in name for n in removable)
        if character!='dodo' and ('goggle' in name or 'amber glass' in name or 'lens reflection' in name or 'swept hair lock' in name):remove=True
        if character=='lili' and ('hair cap' in name or 'ear' in name or 'cheek blush' in name):remove=True
        if character=='bibo' and any(n in name for n in ('hair cap','ear','cheek blush','nose','eyebrow')):remove=True
        if remove:bpy.data.objects.remove(o,do_unlink=True);continue
        bpy.context.collection.objects.link(o)
        original=o.data.materials[0].name.split('.')[0]
        o.data.materials.clear();o.data.materials.append(glow if character=='bibo' and 'eye' in name else mapping[original])
        if character=='bibo' and ('eye' in name or 'smile' in name):o.location.y-=.085
    # Add distinctive head silhouettes in the standing study's coordinate system.
    if character=='lumi':
        for side in (-1,1):
            sphere(f'Twin bun {side}',(side*.49,.025,1.60),(.20,.19,.21),hair)
            sphere(f'Mint bun tie {side}',(side*.46,-.10,1.59),(.115,.05,.12),accent)
        for x,z in [(-.24,1.65),(-.02,1.72),(.18,1.69)]:
            lock=sphere('Side swept fringe',(x,-.22,z),(.15,.20,.13),hair);lock.rotation_euler.y=-.45
    elif character=='lili':
        for side in (-1,1):
            cone(f'Fox ear {side}',(side*.32,0,1.72),.20,.46,skin)
            ear=cone(f'Ivory inner ear {side}',(side*.32,-.12,1.74),.11,.30,ivory);ear.scale.y=.3
            sphere(f'Fox muzzle {side}',(side*.075,-.377,1.105),(.10,.045,.067),ivory)
        sphere('Fox nose',(0,-.435,1.155),(.04,.025,.029),carbon)
    elif character=='bibo':
        sphere('Face screen',(0,-.345,1.21),(.37,.076,.255),carbon)
        for side in (-1,1):
            sphere(f'Round ear speaker {side}',(side*.53,0,1.29),(.10,.16,.15),accent)
        sphere('Antenna stalk',(0,.05,1.81),(.025,.025,.12),alloy,12,8)
        sphere('Antenna light',(0,.05,1.92),(.075,.075,.075),glow)
    bpy.context.view_layer.update()
    for o in set(bpy.context.scene.objects)-vehicle:
        if 'hair cap' in o.name.lower():
            # A real raised forehead boundary, rather than hiding a full cap inside skin.
            vertices=[];faces=[]
            for row in range(13):
                for col in range(48):
                    angle=col*math.tau/48
                    edge=math.pi*(.55-.20*max(0,-math.sin(angle))**2)
                    theta=edge*row/12
                    vertices.append((.54*math.sin(theta)*math.cos(angle),.03+.402*math.sin(theta)*math.sin(angle),1.274+.49*math.cos(theta)))
            for row in range(12):
                for col in range(48):
                    a=row*48+col;b=row*48+(col+1)%48;faces.append((a,b,b+48,a+48))
            mesh=bpy.data.meshes.new('Open forehead hair cap');mesh.from_pydata(vertices,[],faces);mesh.update()
            mesh.materials.append(hair)
            for face in mesh.polygons:face.use_smooth=True
            o.data=mesh;o.matrix_world=Matrix.Identity(4)
    bpy.context.view_layer.update()
    # Bake study transforms before seating: face points +Y in Blender / -Z in glTF.
    transform=Matrix.Translation(p((0,.24,.23))) @ Matrix.Rotation(math.pi,4,'Z') @ Matrix.Scale(.52,4)
    for o in set(bpy.context.scene.objects)-vehicle:
        o.matrix_world=transform @ o.matrix_world
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        reduce(o,.45 if 'hair cap' in o.name.lower() else .75 if o.name.startswith(('Fox ear','Ivory inner ear')) else .32 if 'bun' in o.name.lower() else .48 if o.name=='Head' else .75 if 'eyebrow' in o.name.lower() else .38 if any(t in o.name.lower() for t in ('eye','nose','smile','cheek')) else .17)
    for side in (-1,1):
        limb(f'Seated thigh {side}',(side*.095,.36,.20),(side*.12,.24,-.02),.082,suit)
        limb(f'Seated shin {side}',(side*.12,.24,-.02),(side*.13,.07,-.35),.065,suit)
        sphere(f'Round boot {side}',p((side*.13,.015,-.43)),(.075,.105,.05),ivory,16,8)
        bpy.ops.object.empty_add(type='PLAIN_AXES',location=p((side*.17,.60,.23)))
        arm=bpy.context.object;arm.name=f'ChibiArm{side}'
        parts=[limb('Upper sleeve',(side*.17,.60,.23),(side*.23,.44,.075),.079,suit),limb('Forearm',(side*.23,.44,.075),(side*.16,.414,-.17),.063,suit),sphere('Mitten',p((side*.158,.414,-.189)),(.06,.052,.05),ivory,16,8)]
        for child in parts:child.parent=arm;child.matrix_parent_inverse=arm.matrix_world.inverted()
        for frame,angle in [(1,0),(14,1.9),(28,1.65),(42,1.9),(55,0)]:
            arm.rotation_euler.x=angle;arm.keyframe_insert(data_path='rotation_euler',frame=frame)
        arm.animation_data.action.name=f'Victory{side}';arm.rotation_euler.x=0
    batch()
    metrics.append(export(character))
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH':reduce(o,.85 if o.data.materials[0].name in {'CharacterSkin','CharacterHair'} else .55)
    metrics.append(export(character,True))
(SOURCE/'metrics.json').write_text(json.dumps(metrics,indent=2))
print('CHIBI_COMPLETE',json.dumps(metrics))
