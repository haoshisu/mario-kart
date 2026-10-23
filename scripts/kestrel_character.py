"""Original Aster revision: continuous face, inset almond eyes and tailored suit.

All coordinates use the game's Y-up convention; no imported character assets.
"""
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def build_character(materials, helpers):
    skin, hair, white, iris = [materials[name] for name in ("skin", "hair", "eye", "iris")]
    fabric, suit, ivory, alloy, carbon, paint, glow = [materials[name] for name in ("fabric", "suit", "ivory", "alloy", "carbon", "paint", "glow")]
    mesh, sphere, line, point = [helpers[name] for name in ("mesh", "sphere", "line", "point")]
    base_line = line
    def line(*args, **kwargs):
        obj = base_line(*args, **kwargs)
        obj.data.bevel_resolution = 1
        return obj
    hair.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (.028,.015,.040,1)
    skin.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = .08

    # Face cross sections taper into a jaw rather than a spherical mannequin.
    sections = [(.672,.026,.046),(.695,.076,.077),(.730,.121,.111),(.770,.153,.142),
                (.815,.179,.163),(.855,.190,.174),(.900,.195,.177),(.945,.190,.175),
                (.990,.177,.165),(1.030,.151,.141),(1.066,.111,.108),(1.090,.058,.060),(1.099,.006,.010)]
    center_z = .230

    def face_dimensions(y):
        for a, b in zip(sections, sections[1:]):
            if a[0] <= y <= b[0]:
                t = (y-a[0])/(b[0]-a[0])
                return a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t
        return sections[0][1:] if y < sections[0][0] else sections[-1][1:]

    def gaussian(x, y, cx, cy, wx, wy):
        return math.exp(-((x-cx)/wx)**2-((y-cy)/wy)**2)

    def face_front(x, y):
        width, depth = face_dimensions(y)
        z = center_z-depth*math.sqrt(max(.03,1-(x/width)**2))
        # Nose bridge, tip, cheeks and muzzle belong to the same surface.
        z -= .024*gaussian(x,y,0,.906,.030,.073)
        z -= .062*gaussian(x,y,0,.860,.043,.028)
        z -= .012*gaussian(x,y,0,.799,.060,.028)
        for side in (-1,1):
            z -= .015*gaussian(x,y,side*.109,.837,.057,.038)
            z += .010*gaussian(x,y,side*.077,.922,.050,.033)
        return z

    vertices, faces = [], []
    for y, width, depth in sections:
        for i in range(40):
            angle=i*math.tau/40
            x=width*math.sin(angle)
            z=center_z+depth*math.cos(angle)
            if math.cos(angle)<0:
                z=face_front(x,y)
            vertices.append((x,y,z))
    for row in range(len(sections)-1):
        for i in range(40):
            a=row*40+i; b=row*40+(i+1)%40
            faces.append((a,b,b+40,a+40))
    faces.extend([tuple(reversed(range(40))),tuple(range((len(sections)-1)*40,len(sections)*40))])
    face=mesh("AsterContinuousFace",vertices,faces,skin)
    modifier=face.modifiers.new("FaceSurface", "SUBSURF"); modifier.levels=1
    modifier.render_levels=1
    bpy.context.view_layer.update()
    face_surface = BVHTree.FromObject(face, bpy.context.evaluated_depsgraph_get())
    analytical_front = face_front
    def face_front(x, y):
        location, _, _, _ = face_surface.ray_cast(point((x,y,-2)), point((0,0,1)), 3)
        return -location.y if location is not None else analytical_front(x,y)

    # Conformal face patches sit within eyelids; no protruding white spheres.
    def patch(name, cx, cy, rx, ry, mat, offset, almond=False):
        vertices=[(cx,cy,face_front(cx,cy)-offset)]
        for ring in (0.5,1.0):
            for i in range(20):
                a=i*math.tau/20
                dx=rx*math.cos(a)*ring
                dy=ry*math.sin(a)*ring
                if almond: dy*=.7+.3*abs(math.sin(a))
                x=cx+dx; y=cy+dy
                vertices.append((x,y,face_front(x,y)-offset))
        faces=[(0,1+i,1+(i+1)%20) for i in range(20)]
        faces.extend((1+i,21+i,21+(i+1)%20,1+(i+1)%20) for i in range(20))
        return mesh(name,vertices,faces,mat)

    for side in (-1,1):
        x, y=side*.078,.929
        patch(f"EyeSocket{side}",x,y,.060,.035,hair,.004,True)
        patch(f"AlmondEye{side}",x,y,.055,.029,white,.007,True)
        patch(f"Iris{side}",x-side*.005,y-.002,.020,.025,iris,.009)
        patch(f"Pupil{side}",x-side*.005,y-.002,.010,.020,carbon,.011)
        patch(f"EyeHighlight{side}",x-side*.012,y+.009,.006,.007,white,.013)
        upper=[]; lower=[]
        for i in range(9):
            t=i/8
            px=x+(t*2-1)*.056
            upper_y=y+math.sin(math.pi*t)*.033
            lower_y=y-math.sin(math.pi*t)*.030
            upper.append((px,upper_y,face_front(px,upper_y)-.010))
            lower.append((px,lower_y,face_front(px,lower_y)-.008))
        line(f"UpperLid{side}",upper,.0045,hair)
        line(f"LowerLid{side}",lower,.005,skin)
        brow=[]
        for i in range(5):
            px=x+(i/4*2-1)*.049
            py=.983+.009*math.sin(math.pi*i/4)-side*(px-x)*.11
            brow.append((px,py,face_front(px,py)-.005))
        line(f"ShapedBrow{side}",brow,.0065,hair)
        sphere(f"Ear{side}",(side*.185,.851,.229),(.027,.043,.032),skin,16,8)
        sphere(f"EarInset{side}",(side*.205,.850,.215),(.004,.022,.013),suit,12,6)

    smile=[]
    for i in range(9):
        x=(i/8*2-1)*.052; y=.788+.012*(abs(x)/.052)**1.5
        smile.append((x,y,face_front(x,y)-.004))
    line("ConfidentSmile",smile,.0028,hair)
    for side in (-1,1):
        patch(f"MouthCorner{side}",side*.052,.800,.003,.003,hair,.005)

    # Sculpted swept fringe sits across the forehead under a thin helmet brim.
    def swept_lock(name, path, widths):
        vertices=[]
        for row, ((x,y,z), width) in enumerate(zip(path,widths)):
            tangent=(Vector(path[min(row+1,len(path)-1)])-Vector(path[max(row-1,0)])).normalized()
            lateral=Vector((0,0,1)).cross(tangent).normalized()
            normal=tangent.cross(lateral).normalized()
            for i in range(8):
                a=i*math.tau/8
                vertex=Vector((x,y,z))+lateral*math.cos(a)*width+normal*math.sin(a)*width*.5
                vertices.append(tuple(vertex))
        faces=[]
        for row in range(len(path)-1):
            for i in range(8):
                a=row*8+i; b=row*8+(i+1)%8
                faces.append((a,b,b+8,a+8))
        faces.extend([tuple(reversed(range(8))),tuple(range((len(path)-1)*8,len(path)*8))])
        obj=mesh(name,vertices,faces,hair)
        mod=obj.modifiers.new("SweptHairSurface","SUBSURF");mod.levels=1
        return obj
    swept_lock("SweptFringeMain",[(-.128,1.028,.158),(-.098,1.040,.093),(-.035,1.033,.053),(.044,1.016,.046),(.096,.999,.077)],[.011,.029,.032,.025,.002])
    swept_lock("SweptFringeTip",[(-.116,1.030,.126),(-.080,1.031,.076),(-.018,1.009,.046),(.036,.987,.054)],[.010,.026,.022,.002])
    for side in (-1,1):
        swept_lock(f"Sideburn{side}",[(side*.173,.983,.240),(side*.183,.934,.186),(side*.172,.875,.188)],[.017,.016,.003])

    # Retro racing cap: open front, shaped rim, ear mounts and a player-colour stripe.
    vertices=[]; faces=[]
    rows=[0,.25,.48,.68,.88,1.06,1.26,1.46,1.65]
    for theta in rows:
        for i in range(32):
            phi=i*math.tau/32
            vertices.append((math.sin(theta)*math.sin(phi)*.215,.912+math.cos(theta)*.228,.254+math.sin(theta)*math.cos(phi)*.191))
    for row in range(len(rows)-1):
        for i in range(32):
            phi=(i+.5)*math.tau/32
            if row>=4 and math.cos(phi)<-.28: continue
            a=row*32+i;b=row*32+(i+1)%32
            faces.append((a,b,b+32,a+32))
    mesh("AsterShapedHelmet",vertices,faces,ivory)
    line("ForeheadBrim",[(-.162,1.019,.141),(-.115,1.044,.114),(0,1.057,.101),(.115,1.044,.114),(.162,1.019,.141)],.010,ivory)
    for side in (-1,1):
        line(f"OpenHelmetRim{side}",[(side*.163,1.023,.143),(side*.201,.977,.168),(side*.208,.922,.181)],.006,carbon)
        sphere(f"EarMount{side}",(side*.217,.935,.256),(.012,.037,.035),alloy,12,8)
        line(f"HelmetSideAccent{side}",[(side*.179,1.034,.276),(side*.205,.989,.283),(side*.213,.952,.279)],.012,paint)
    line("HelmetCenterStripe",[(0,1.107,.155),(0,1.141,.253),(0,1.111,.354),(0,1.023,.423)],.019,paint)

    # Ring lofts form a fitted jacket and continuous limbs across the elbows.
    def loft(name, centers, widths, depths, mat, segments=12):
        vertices=[]
        for row, center in enumerate(centers):
            tangent=Vector(centers[min(row+1,len(centers)-1)])-Vector(centers[max(row-1,0)])
            tangent.normalize()
            axis=Vector((1,0,0))
            if abs(tangent.dot(axis))>.9: axis=Vector((0,0,1))
            right=tangent.cross(axis).normalized(); normal=right.cross(tangent).normalized()
            for i in range(segments):
                a=i*math.tau/segments
                v=Vector(center)+normal*math.cos(a)*widths[row]+right*math.sin(a)*depths[row]
                vertices.append(tuple(v))
        faces=[]
        for row in range(len(centers)-1):
            for i in range(segments):
                a=row*segments+i;b=row*segments+(i+1)%segments
                faces.append((a,b,b+segments,a+segments))
        faces.extend([tuple(reversed(range(segments))),tuple(range((len(centers)-1)*segments,len(centers)*segments))])
        return mesh(name,vertices,faces,mat)

    sphere("SeatedHip",(0,.175,.23),(.155,.115,.135),suit,16,8)
    loft("FittedRacingJacket",[(0,.22,.235),(0,.30,.247),(0,.41,.253),(0,.53,.255),(0,.59,.250),(0,.625,.248)],[.13,.145,.173,.190,.176,.072],[.098,.112,.122,.121,.11,.062],fabric,20)
    sphere("Neck",(0,.653,.231),(.065,.067,.058),skin,16,8)
    line("JacketCollar",[(-.069,.628,.194),(0,.640,.181),(.069,.628,.194),(.069,.628,.290),(0,.637,.300),(-.069,.628,.290)],.013,ivory,True)
    line("JacketZip",[(0,.277,.135),(0,.410,.124),(0,.542,.132),(0,.618,.179)],.0035,alloy)
    for side in (-1,1):
        line(f"JacketPanel{side}",[(side*.086,.29,.142),(side*.121,.42,.152),(side*.132,.53,.167)],.005,ivory)
        loft(f"SeatedTrouser{side}",[(side*.085,.18,.19),(side*.106,.17,.045),(side*.121,.13,-.13),(side*.123,.065,-.31),(side*.123,.005,-.46)],[.069,.072,.065,.053,.042],[.065,.066,.061,.05,.041],suit)
        sphere(f"RacingBoot{side}",(side*.124,-.020,-.480),(.060,.045,.092),carbon,16,8)
        line(f"BootSeam{side}",[(side*.085,.007,-.498),(side*.124,.010,-.552),(side*.162,.007,-.498)],.004,ivory)

    for side in (-1,1):
        bpy.ops.object.empty_add(type="PLAIN_AXES",location=point((side*.162,.577,.245)))
        arm=bpy.context.object;arm.name=f"AsterArm{side}"
        sleeve=loft(f"ContinuousSleeve{side}",[(side*.159,.57,.243),(side*.202,.517,.196),(side*.237,.446,.091),(side*.210,.420,-.025),(side*.160,.416,-.160)],[.070,.066,.056,.048,.037],[.067,.062,.054,.046,.036],fabric)
        glove=sphere(f"FittedGlove{side}",(side*.158,.414,-.189),(.044,.038,.048),ivory,16,8)
        thumb=sphere(f"GloveThumb{side}",(side*.129,.391,-.187),(.017,.024,.023),ivory,12,6)
        cuff=line(f"GloveCuff{side}",[(side*.126,.420,-.155),(side*.158,.450,-.160),(side*.191,.420,-.155)],.010,carbon)
        for child in (sleeve,glove,thumb,cuff):
            child.parent=arm;child.matrix_parent_inverse=arm.matrix_world.inverted()
        for frame,angle in [(1,0),(14,1.9),(28,1.65),(42,1.9),(55,0)]:
            arm.rotation_euler.x=angle;arm.keyframe_insert(data_path="rotation_euler",frame=frame)
        arm.animation_data.action.name=f"Victory{side}"
        arm.rotation_euler.x=0
