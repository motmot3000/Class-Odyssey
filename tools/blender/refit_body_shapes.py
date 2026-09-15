"""Small, shared silhouette adjustments for the bodies and fitted clothing."""
import math

def smooth(t):
    t=max(0.0,min(1.0,t))
    return t*t*(3-2*t)

def body_shape_point(point,gender):
    p=point.copy()
    x,y,z=p
    if not .70<z<1.455:
        return p
    edge=smooth((z-.70)/.055)*smooth((1.455-z)/.04)
    torso=(1-smooth((abs(x)-.19)/.06))*(1-smooth((abs(y)-.17)/.055))
    def band(center,width):return math.exp(-((z-center)/width)**4)
    hip=band(.885,.080)
    waist=band(1.045,.060)
    chest=band(1.275,.125)
    shoulders=band(1.385,.045)
    front=smooth((-y-.015)/.10)
    if gender=='girl':
        # About 5% at the widest hip section; a very slight chest contour
        # beneath the starter top. Posterior depth is deliberately unchanged.
        width=.050*hip-.015*waist+.009*chest+.010*shoulders
        bust=.0045*math.exp(-((z-1.315)/.055)**2-((abs(x)-.065)/.060)**2)
        p.y-=bust*front*torso*edge
    else:
        # More of a light V-shaped torso, not a bodybuilder silhouette.
        width=-.035*hip-.018*waist+.035*chest+.020*shoulders
        p.y-=.0025*math.exp(-((z-1.30)/.075)**2)*(1-.60*math.exp(-(x/.033)**2))*front*torso*edge
    p.x*=1+width*torso*edge
    # Restrained upper-arm definition shared by both adventurers.
    arm=math.exp(-((abs(x)-.247)/.035)**2-((z-1.205)/.085)**2)
    p.y-=.0012*arm*edge
    return p

def athletic_body_point(point,gender):
    """Second body pass over the face-approved snapshots: less posterior
    projection, clearer athletic contours, and distinct but restrained shapes.
    """
    p=point.copy();x,y,z=p
    if not .50<z<1.455:return p
    edge=smooth((z-.50)/.06)*smooth((1.455-z)/.045)
    torso=(1-smooth((abs(x)-.19)/.055))*(1-smooth((abs(y)-.17)/.05))
    front=smooth((-y-.005)/.10)
    def band(center,width):return math.exp(-((z-center)/width)**4)
    hip=band(.89,.085);waist=band(1.045,.065)
    chest=band(1.285,.115);shoulder=band(1.38,.055)
    # Smoothly flatten the rear without reducing the whole pelvis or thighs.
    rear=smooth(y/.085)
    seat=band(.875,.095)*rear*torso*edge
    p.y*=1-.22*seat
    if gender=='girl':
        p.x*=1+(.035*hip-.017*waist+.008*chest+.012*shoulder)*torso*edge
        bust=.0035*math.exp(-((z-1.31)/.058)**2-((abs(x)-.064)/.06)**2)
        p.y-=bust*front*torso*edge
        thigh=band(.715,.105)*(1-smooth((abs(x)-.19)/.035))
        sign=1 if x>=0 else -1
        p.x+=(x-sign*.097)*.075*thigh*edge
        p.y+=(y-.005)*.045*thigh*edge
        arm_scale=.05
    else:
        p.x*=1+(-.025*hip-.015*waist+.035*chest+.030*shoulder)*torso*edge
        pec=math.exp(-((z-1.31)/.073)**2-((abs(x)-.062)/.066)**2)
        p.y-=.0035*pec*front*torso*edge
        arm_scale=.075
    # A pair of mild abdominal planes beneath the shirt, not a carved six-pack.
    abdomen=band(1.145,.070)
    planes=math.exp(-((abs(x)-.043)/.035)**2)
    p.y-=.0018*abdomen*planes*front*torso*edge
    # Shape the sleeves and underlying upper arms together; preserve hands.
    arm=band(1.22,.135)*math.exp(-((abs(x)-.241)/.044)**4)*edge
    sign=1 if x>=0 else -1
    p.x+=(x-sign*.239)*arm_scale*arm
    p.y+=(y+.017)*arm_scale*arm
    return p

def apply_body_shape(obj,gender,revision='v1'):
    if obj.type!='MESH' or obj.get('shop_slot') not in ['core','persona','outfit']:
        return 0
    matrix=obj.matrix_world.copy();inverse=matrix.inverted()
    source_normals=[tuple(normal.vector) for normal in obj.data.corner_normals]
    protected={vertex.index for vertex in obj.data.vertices if (matrix @ vertex.co).z>=1.455}
    count=0
    for vertex in obj.data.vertices:
        if vertex.index in protected:
            continue
        source=matrix @ vertex.co
        target=(athletic_body_point if revision=='v2' else body_shape_point)(source,gender)
        if (target-source).length>.000001:count+=1
        vertex.co=inverse @ target
    if count:
        # Recalculate body normals only. The approved head's corner normals
        # are copied verbatim, including UV seams and eyelid boundaries.
        obj.data.normals_split_custom_set([source_normals[loop.index] if loop.vertex_index in protected else (0,0,0) for loop in obj.data.loops])
        obj.data.update()
    return count
