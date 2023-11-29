import {defs, tiny} from './examples/common.js';
import { Chunk_Manager, Perlin_Noise } from './world_gen.js';
import { CustomMovementControls } from './controls.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture,
} = tiny;

const {Textured_Phong} = defs;

class Cube_Single_Strip extends Shape {
    constructor() {
        super("position", "normal");
        this.arrays.position = Vector3.cast(
            [ 0.5,  0.5,  0.5],
            [-0.5,  0.5,  0.5],
            [ 0.5,  0.5, -0.5],
            [-0.5,  0.5, -0.5],
            [ 0.5, -0.5,  0.5],
            [-0.5, -0.5,  0.5],
            [-0.5, -0.5, -0.5],
            [ 0.5, -0.5, -0.5],
        );
        this.arrays.normal = this.arrays.position;
        this.indices.push(3, 2, 6, 7, 4, 2, 0, 3, 1, 6, 5, 4, 1, 0);
    }
}

class Square extends Shape {
    constructor() {
        super("position", "normal", "texture_coord");
        this.arrays.position = Vector3.cast([-0.5, -0.5, 0], [0.5, -0.5, 0], [-0.5, 0.5, 0], [0.5, 0.5, 0]);
        this.arrays.normal = Vector3.cast([0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]);
        this.arrays.texture_coord = Vector.cast([0, 0], [1, 0], [0, 1], [1, 1]);
        this.indices.push(0, 1, 2, 1, 3, 2);
    }
}

class Cube extends Shape {
    constructor() {
        super("position", "normal", "texture_coord");
        for (let i = 0; i < 3; i++)
            for (let j = 0; j < 2; j++) {
                const square_transform = Mat4.rotation(i == 0 ? Math.PI / 2 : 0, 1, 0, 0)
                    .times(Mat4.rotation(Math.PI * j - (i == 1 ? Math.PI / 2 : 0), 0, 1, 0))
                    .times(Mat4.translation(0, 0, 0.5));
                Square.insert_transformed_copy_into(this, [], square_transform);
            }
    }
}

export class Main extends Scene {
    constructor() {
        super();

        this.shapes = {
            cube: new Cube(),
            test: new Cube_Single_Strip(),
        };

        this.materials = {
            phong: new Material(new defs.Phong_Shader(), {
                ambient: .4, diffusivity: .6, specularity: 0.1,
                color: hex_color("#ffffff")
            }),
            grass: new Material(new Textured_Phong(), {
                color: hex_color("#171b24"),
                ambient: 0.4, diffusivity: 1.0, specularity: 0.1,
                texture: new Texture("assets/grass.png", "LINEAR_MIPMAP_LINEAR")
            }),
            stone: new Material(new Textured_Phong(), {
                color: hex_color("#171b24"),
                ambient: 0.4, diffusivity: 1.0, specularity: 0.1,
                texture: new Texture("assets/stone.png", "LINEAR_MIPMAP_LINEAR")
            }),
            sky_day: color(124/255, 173/255, 255/255, 1),
            sky_night: color(0, 0, 0, 1),
        };

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
        this.perlin = new Perlin_Noise();
        this.Chunk_Manager = new Chunk_Manager(this.perlin);
        this.Chunk_Manager.add_chunk(0, 0);
        // this.Chunk_Manager.add_chunk(0, 1);
        // this.Chunk_Manager.add_chunk(1, 0);
        // this.Chunk_Manager.add_chunk(1, 1);

    }

    make_control_panel() {
        // press t to regenerate the world
        this.key_triggered_button("new terrain", ["t"], () => {
            this.perlin.seed();                         // randomly create new perlin permutation
            this.Chunk_Manager.generate_chunks();       // regenerate world w/ new noise map
            this.Chunk_Manager.update_chunk_meshes();   // update surface area mesh
        });

        this.new_line(); this.new_line();

        // create input controls
        this.control_panel.innerHTML += "write coordinate as 'x y z' <br>";
        const xyz_input = this.control_panel.appendChild(document.createElement("input"));
        this.new_line();
        xyz_input.setAttribute("type", "text");
        xyz_input.setAttribute("placeholder", "x y z");
        this.key_triggered_button("place block", ["p"], () => {
            console.log("place");
            console.log(xyz_input.value);
        });
        this.key_triggered_button("delete block", ["o"], () => {
            console.log("delete");
        });
    }

    set_camera_above_block(delta) {
        let blockPosition = this.find_starting_block_position();
        return [blockPosition[0], blockPosition[1] + delta, blockPosition[2]];
    }
    
    find_starting_block_position() {
        const chunk = this.Chunk_Manager.chunks.get("0,0"); // Access Chunk 0,0
        const baseIndex = 16368;                            // Base index for position (31, y, 31)
        let highestY = -1;                                  // Initialize the highest block's y-coordinate

        for (let y = 0; y <= 15; y++) {                     // Iterate over y-coordinates from 0 to 15
            if (chunk.blocks[baseIndex + y] != null) {      // Check if the block at this index is not null
                highestY = y;                               // Update the highest y-coordinate
            }
        }

        console.log(highestY);

        if (highestY === -1) {                              // If no valid block is found, return a default position
            return [-31, 0, -31];                           // Return a default position if needed
        }

        return [-31, -highestY, -31];                       // Return the coordinates of the highest block
    }

    display(context, program_state) {
        // grab gl pointer to handle sky color
        const gl = context.context;

        // on first frame...
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls);
            const [x_initial, y_initial, z_initial] = this.set_camera_above_block(-10);         // set player pos
            program_state.set_camera(Mat4.translation(x_initial, y_initial, z_initial));
            program_state.projection_transform = Mat4.perspective(                              // set camera as perspective
                Math.PI / 4, 
                context.width / context.height, 
                1, 256);
            program_state.lights = [new Light(vec4(0, 20, 0, 1), color(1, 1, 1, 1), 10000)];    // create lights
        }

        let model_transform;
        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

        // handle sky
        const sky_time = 0.5 * Math.cos(2 * Math.PI * t / 60.0) + 0.5;                      // 60s cycle between [0,1]
        const sky_color = this.materials.sky_night.mix(this.materials.sky_day, sky_time);   // lin interp between night/day
        gl.clearColor.apply(gl, sky_color);                                                 // set background draw color

        // draw blocks
        for (const c of this.Chunk_Manager.chunks.values()) {
            for (const coord of c.coords) {
                model_transform = Mat4.identity().times(Mat4.translation(coord.x,coord.y,coord.z));
                if (coord.t == 1)
                    this.shapes.cube.draw(context, program_state, model_transform, this.materials.grass);
                if (coord.t == 2)
                    this.shapes.cube.draw(context, program_state, model_transform, this.materials.stone);
            }
        }
    }
}