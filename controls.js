import {defs, tiny} from './examples/common.js';

export class CustomMovementControls extends defs.Movement_Controls {
    constructor() {
        super();

        this.roll = 0;                      // Disable rolling by default
        this.look_around_locked = false;    // Set to false to allow looking around
        this.speed_multiplier = 0.25;       // Normal speed
    }

    // Override the display method to modify behavior
    display(context, graphics_state, dt = graphics_state.animation_delta_time / 1000) {
        this.roll = 0;                              // Prevent rolling left or right
        super.display(context, graphics_state, dt); // Call the super class display method
    }

    // Override the first_person_flyaround method to restrict up/down movement
    first_person_flyaround(radians_per_frame, meters_per_frame, leeway = 70) {
        // Prevent moving up and down
        this.thrust[1] = 0;
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
        this.key_triggered_button("Up", [" "], () => this.thrust[1] = -1, undefined, () => this.thrust[1] = 0);
        this.key_triggered_button("Sprint", ["Shift"], () => this.speed_multiplier = 0.75, undefined, () => this.speed_multiplier = 0.25);
        this.new_line();
        this.key_triggered_button("Forward", ["w"], () => this.thrust[2] = 1, undefined, () => this.thrust[2] = 0);
        this.key_triggered_button("Left", ["a"], () => this.thrust[0] = 1, undefined, () => this.thrust[0] = 0);
        this.key_triggered_button("Back", ["s"], () => this.thrust[2] = -1, undefined, () => this.thrust[2] = 0);
        this.key_triggered_button("Right", ["d"], () => this.thrust[0] = -1, undefined, () => this.thrust[0] = 0);
        this.new_line();
    }
}