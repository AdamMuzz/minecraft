import {defs, tiny} from './examples/common.js';

export class CustomMovementControls extends defs.Movement_Controls {
    constructor() {
        super();

        this.mouseX = 0;
        this.mouseY = 0;
        this.total_x_rotation = 0;
        this.roll = 0;                      // Disable rolling by default
        this.look_around_locked = true;    // Set to false to allow looking around
        this.speed_multiplier = 0.25;       // Normal speed
        this.canvas_width = 0;
        this.canvas_height = 0;
        
    }


    add_mouse_controls(canvas) {
        if (this.mouse_enabled_canvases.has(canvas))
            return;
        this.mouse_enabled_canvases.add(canvas);

        // First, measure mouse steering, for rotating the flyaround camera:
        this.mouse = {"from_center": tiny.vec(0, 0)};

        const mouse_position = (e, rect = canvas.getBoundingClientRect()) => {
            // Update mouseX and mouseY
            this.mouseX = e.clientX - (rect.left + rect.right) / 2;
            this.mouseY = e.clientY - (rect.bottom + rect.top) / 2;

            return tiny.vec(this.mouseX, this.mouseY);
        };
        // Set up mouse response
        document.addEventListener("mouseup", e => { this.mouse.anchor = undefined; });
        canvas.addEventListener("mousedown", e => {
            e.preventDefault();
            this.mouse.anchor = mouse_position(e);
        });
        canvas.addEventListener("mousemove", e => {
            e.preventDefault();
            this.mouse.from_center = mouse_position(e);
        });
        canvas.addEventListener("mouseout", e => {
            if (!this.mouse.anchor) this.mouse.from_center.scale_by(0);
        });
        this.canvas_width = canvas.width;
        this.canvas_height = canvas.height;
    }

    // Override the display method to modify behavior
    display(context, graphics_state, dt = graphics_state.animation_delta_time / 1000) {
        this.roll = 0;                              // Prevent rolling left or right
        super.display(context, graphics_state, dt); // Call the super class display method
    }



    // Override the first_person_flyaround method to restrict up/down movement
    first_person_flyaround(radians_per_frame, meters_per_frame, leeway = 70) {
        // Prevent moving up and down
        this.mouse.from_center[1] = Math.max(Math.min(this.mouse.from_center[1], leeway/2), -leeway/2);
        // Call the super class method
        super.first_person_flyaround(radians_per_frame, meters_per_frame, leeway);
    }
    
    make_control_panel(){
        // this.control_panel.innerHTML += "Click and drag the scene to spin your viewpoint around it.<br>";
        this.live_string(box => {
            box.textContent = "- Position: " + 
                this.pos[0].toFixed(2) + ", " + 
                this.pos[1].toFixed(2) + ", " + 
                this.pos[2].toFixed(2)
        });
        this.new_line();
        this.live_string(box => {
            box.textContent = "- Facing: " + ((this.z_axis[0] > 0 ? "West " : "East ")
            + (this.z_axis[1] > 0 ? "Down " : "Up ") + (this.z_axis[2] > 0 ? "North" : "South"))
        });
        this.new_line();
        this.new_line();
        this.key_triggered_button("Jump", [" "], () => this.thrust[1] = -3, undefined, () => this.thrust[1] = 0);
        this.key_triggered_button("Sprint", ["Shift"], () => this.speed_multiplier = 0.75, undefined, () => this.speed_multiplier = 0.25);
        this.new_line();
        this.key_triggered_button("Forward", ["w"], () => this.thrust[2] = 1, undefined, () => this.thrust[2] = 0);
        this.key_triggered_button("Left", ["a"], () => this.thrust[0] = 1, undefined, () => this.thrust[0] = 0);
        this.key_triggered_button("Back", ["s"], () => this.thrust[2] = -1, undefined, () => this.thrust[2] = 0);
        this.key_triggered_button("Right", ["d"], () => this.thrust[0] = -1, undefined, () => this.thrust[0] = 0);
        this.new_line();
    }
}