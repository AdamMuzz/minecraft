// simple 2d vector w/ dot product for perlin noise
class Vector2 {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}

	dot(other) {
		return this.x*other.x + this.y*other.y;
	}
}

// perlin noise generator
//  creates smooth random noise for use in terrain gen
export class Perlin_Noise {
    constructor() {
        this.permutation;
        this.seed();
    }

    shuffle(arr) {
        for(let i = arr.length-1; i > 0; i--) {
            const index = Math.round(Math.random()*(i-1));
            const temp = arr[i];
            
            arr[i] = arr[index];
            arr[index] = temp;
        }
    }

    seed() {
        const perm = [];
        for(let i = 0; i < 256; i++) {
            perm.push(i);
        }
    
        this.shuffle(perm);
        
        for (let i = 0; i < 256; i++) {
            perm.push(perm[i]);
        }
        
        this.permutation = perm;
    }

    get_constant_vector(v) {
        // v is the value from the permutation table
        const h = v & 3;
        if(h == 0)
            return new Vector2(1.0, 1.0);
        else if(h == 1)
            return new Vector2(-1.0, 1.0);
        else if(h == 2)
            return new Vector2(-1.0, -1.0);
        else
            return new Vector2(1.0, -1.0);
    }

    fade(t) {
        return ((6*t - 15)*t + 10)*t*t*t;
    }
    
    lerp(t, a1, a2) {
        return a1 + t*(a2-a1);
    }

    get(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
    
        const xf = x-Math.floor(x);
        const yf = y-Math.floor(y);
    
        const topRight = new Vector2(xf-1.0, yf-1.0);
        const topLeft = new Vector2(xf, yf-1.0);
        const bottomRight = new Vector2(xf-1.0, yf);
        const bottomLeft = new Vector2(xf, yf);
        
        // Select a value from the permutation array for each of the 4 corners
        const valueTopRight = this.permutation[this.permutation[X+1]+Y+1];
        const valueTopLeft = this.permutation[this.permutation[X]+Y+1];
        const valueBottomRight = this.permutation[this.permutation[X+1]+Y];
        const valueBottomLeft = this.permutation[this.permutation[X]+Y];
        
        const dotTopRight = topRight.dot(this.get_constant_vector(valueTopRight));
        const dotTopLeft = topLeft.dot(this.get_constant_vector(valueTopLeft));
        const dotBottomRight = bottomRight.dot(this.get_constant_vector(valueBottomRight));
        const dotBottomLeft = bottomLeft.dot(this.get_constant_vector(valueBottomLeft));
        
        const u = this.fade(xf);
        const v = this.fade(yf);
        
        return this.lerp(u,
            this.lerp(v, dotBottomLeft, dotTopLeft),
            this.lerp(v, dotBottomRight, dotTopRight)
        );
    }
}

// Chunks store world's block information
class Chunk {
    // create a new chunk
    //  x: int x cord of chunk
    //  z: int z cord of chunk
    //  perlin: ref to perlin noise generator
    constructor(x, z, perlin) {
        this.x = x;
        this.z = z;
        this.blocks;
        this.coords;
        this.generate(perlin);
        this.update_mesh();
    }

    // generate chunk's blocks w/ perlin noise
    //  assume 32x16x32 dimensions
    //  perlin grid is [0,1] ==> step size is 1/32
    generate(perlin) {
        (this.blocks = []).length = 16384;
        for (let x = 0; x < 32; x++) {
            for (let z = 0; z < 32; z++) {
                const px = this.x + x / 32.0;                           // convert spot in chunk ==> world spot
                const pz = this.z + z / 32.0;

                const y = Math.floor((perlin.get(px,pz) + 1) * 7.5);    // generate y & map [-1,1] ==> [0,15]
                let idx = y + (z << 4) + (x << 9);                      // convert from (x,y,z) ==> idx
                this.blocks[idx] = 1;
                
                for (let i = 0; i < y; i++) {                           // fill in blocks below surface as stone
                    idx = i + (z << 4) + (x << 9);
                    this.blocks[idx] = 2;
                }
            }
        }
    }

    // find all blocks that are touching air and hence "visible"
    update_mesh() {
        this.coords = [];
        for (let i = 0; i < this.blocks.length; i++) {
            if (this.blocks[i] != null) {                   // cur block exists, check if neighbors are air or boundary
                let pos = i;
                const y = pos % 16; pos -= y; pos >>= 4;    // convert from idx ==> (x,y,z)
                const z = (pos % 32); pos -= z; pos >>= 5;
                const x = (pos % 32);

                if (x == 0 || x == 31 ||                    // always display chunk boundaries
                    z == 0 || z == 31 ||
                    y == 0 || y == 15) {
                    this.coords.push({
                        x: x + this.x * 32,
                        y: y,
                        z: z + this.z * 32,
                        t: this.blocks[i],
                    });
                }
                else {                                      // if internal block then check for air on any face
                    const d = this.blocks[i-1];
                    const u = this.blocks[i+1];
                    const l = this.blocks[i-512];
                    const r = this.blocks[i+512];
                    const b = this.blocks[i-16];
                    const f = this.blocks[i+16];
                    if (d == null || u == null || l == null || r == null || b == null || f == null) {
                        this.coords.push({
                            x: x + this.x * 32,             // x,y,z coords
                            y: y,
                            z: z + this.z * 32,
                            t: this.blocks[i],              // block type
                        });
                    }
                }
            }
        }
    }
}

// manager to handle the world's chunks
//  maps each chunk's (x,y) pos ==> the chunk itself
export class Chunk_Manager {
    constructor(perlin) {
        this.perlin = perlin;
        this.chunks = new Map();
    }

    add_chunk(x, y) {
        this.chunks.set(`${x},${y}`, new Chunk(x, y, this.perlin));
    }

    generate_chunks() {
        for (const c of this.chunks.values()) {
            c.generate(this.perlin);
        }
    }

    update_chunk_meshes() {
        for (const c of this.chunks.values()) {
            c.update_mesh();
        }
    }
}