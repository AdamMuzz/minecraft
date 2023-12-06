import { tiny } from './tiny-graphics';
const { Graphics_Card_Object, Graphics_Addresses } = tiny;

// https://webglfundamentals.org/webgl/lessons/webgl-instanced-drawing.html

class Instance_Shader extends Graphics_Card_Object {
    constructor(num_lights = 2) {
        super();
        this.num_lights = num_lights;
    }

    copy_onto_graphics_card(context) {
        // copy_onto_graphics_card():  Called automatically as needed to load the
        // shader program onto one of your GPU contexts for its first time.

        // Define what this object should store in each new WebGL Context:
        const initial_gpu_representation = {
            program: undefined, gpu_addresses: undefined,
            vertShdr: undefined, fragShdr: undefined
        };
        // Our object might need to register to multiple GPU contexts in the case of
        // multiple drawing areas.  If this is a new GPU context for this object,
        // copy the object to the GPU.  Otherwise, this object already has been
        // copied over, so get a pointer to the existing instance.
        const gpu_instance = super.copy_onto_graphics_card(context, initial_gpu_representation);

        const gl = context;
        const program = gpu_instance.program || context.createProgram();
        const vertShdr = gpu_instance.vertShdr || gl.createShader(gl.VERTEX_SHADER);
        const fragShdr = gpu_instance.fragShdr || gl.createShader(gl.FRAGMENT_SHADER);

        if (gpu_instance.vertShdr) gl.detachShader(program, vertShdr);
        if (gpu_instance.fragShdr) gl.detachShader(program, fragShdr);

        gl.shaderSource(vertShdr, this.vertex_glsl_code());
        gl.compileShader(vertShdr);
        if (!gl.getShaderParameter(vertShdr, gl.COMPILE_STATUS))
            throw "Vertex shader compile error: " + gl.getShaderInfoLog(vertShdr);

        gl.shaderSource(fragShdr, this.fragment_glsl_code());
        gl.compileShader(fragShdr);
        if (!gl.getShaderParameter(fragShdr, gl.COMPILE_STATUS))
            throw "Fragment shader compile error: " + gl.getShaderInfoLog(fragShdr);

        gl.attachShader(program, vertShdr);
        gl.attachShader(program, fragShdr);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            throw "Shader linker error: " + gl.getProgramInfoLog(this.program);

        Object.assign(gpu_instance, {
            program,
            vertShdr,
            fragShdr,
            gpu_addresses: undefined
        });
        return gpu_instance;
    }

    activate(context, buffer_pointers, program_state, model_transform, material) {
        // activate(): Selects this Shader in GPU memory so the next shape draws using it.
        const gpu_instance = super.activate(context);
        context.useProgram(gpu_instance.program);

        // --- Send over all the values needed by this particular shader to the GPU: ---
        this.update_GPU(context, gpu_instance.gpu_addresses, program_state, model_transform, material);

        // --- Turn on all the correct attributes and make sure they're pointing to the correct ranges in GPU memory. ---
        for (let [attr_name, attribute] of Object.entries(gpu_instance.gpu_addresses.shader_attributes)) {
            if (!attribute.enabled) {
                if (attribute.index >= 0) context.disableVertexAttribArray(attribute.index);
                continue;
            }
            context.enableVertexAttribArray(attribute.index);
            context.bindBuffer(context.ARRAY_BUFFER, buffer_pointers[attr_name]);
            // Activate the correct buffer.
            context.vertexAttribPointer(attribute.index, attribute.size, attribute.type,
                attribute.normalized, attribute.stride, attribute.pointer);
            // Populate each attribute
            // from the active buffer.
        }
    }

    // Your custom Shader has to override the following functions:
    vertex_glsl_code() {
    }

    fragment_glsl_code() {
    }

    send_material(gl, gpu, material) {
        // send_material(): Send the desired shape-wide material qualities to the
        // graphics card, where they will tweak the Phong lighting formula.
        gl.uniform4fv(gpu.shape_color, material.color);
        gl.uniform1f(gpu.ambient, material.ambient);
        gl.uniform1f(gpu.diffusivity, material.diffusivity);
        gl.uniform1f(gpu.specularity, material.specularity);
        gl.uniform1f(gpu.smoothness, material.smoothness);
    }

    send_gpu_state(gl, gpu, gpu_state, model_transform) {
        // send_gpu_state():  Send the state of our whole drawing context to the GPU.
        const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
        const squared_scale = model_transform.reduce(
            (acc, r) => {
                return acc.plus(vec4(...r).times_pairwise(r))
            }, vec4(0, 0, 0, 0)).to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        // Send the current matrices to the shader.  Go ahead and pre-compute
        // the products we'll need of the of the three special matrices and just
        // cache and send those.  They will be the same throughout this draw
        // call, and thus across each instance of the vertex shader.
        // Transpose them since the GPU expects matrices as column-major arrays.
        const PCM = gpu_state.projection_transform.times(gpu_state.camera_inverse).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));

        // Omitting lights will show only the material color, scaled by the ambient term:
        if (!gpu_state.lights.length)
            return;

        const light_positions_flattened = [], light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // Fill in any missing fields in the Material object with custom defaults for this shader:
        const defaults = {color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
        material = Object.assign({}, defaults, material);

        this.send_material(context, gpu_addresses, material);
        this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
    }
}

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector('#canvas');
  const gl = canvas.getContext('webgl');
  if (!gl) {
    return;
  }

  const ext = gl.getExtension('ANGLE_instanced_arrays');
  if (!ext) {
    return alert('need ANGLE_instanced_arrays');  // eslint-disable-line
  }

  // setup GLSL programs
  // compiles shaders, links program
  const program = webglUtils.createProgramFromScripts(
      gl, ['vertex-shader-3d', 'fragment-shader-3d']);

  const positionLoc = gl.getAttribLocation(program, 'a_position');
  const colorLoc = gl.getAttribLocation(program, 'color');
  const matrixLoc = gl.getAttribLocation(program, 'matrix');
  const projectionLoc = gl.getUniformLocation(program, 'projection');
  const viewLoc = gl.getUniformLocation(program, 'view');

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.1,  0.4,
      -0.1, -0.4,
       0.1, -0.4,
       0.1, -0.4,
      -0.1,  0.4,
       0.1,  0.4,
       0.4, -0.1,
      -0.4, -0.1,
      -0.4,  0.1,
      -0.4,  0.1,
       0.4, -0.1,
       0.4,  0.1,
    ]), gl.STATIC_DRAW);
  const numVertices = 12;

  // setup matrices, one per instance
  const numInstances = 5;
  // make a typed array with one view per matrix
  const matrixData = new Float32Array(numInstances * 16);
  const matrices = [];
  for (let i = 0; i < numInstances; ++i) {
    const byteOffsetToMatrix = i * 16 * 4;
    const numFloatsForView = 16;
    matrices.push(new Float32Array(
        matrixData.buffer,
        byteOffsetToMatrix,
        numFloatsForView));
  }

  const matrixBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, matrixBuffer);
  // just allocate the buffer
  gl.bufferData(gl.ARRAY_BUFFER, matrixData.byteLength, gl.DYNAMIC_DRAW);

  // setup colors, one per instance
  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([
          1, 0, 0, 1,  // red
          0, 1, 0, 1,  // green
          0, 0, 1, 1,  // blue
          1, 0, 1, 1,  // magenta
          0, 1, 1, 1,  // cyan
        ]),
      gl.STATIC_DRAW);

  function render(time) {
    time *= 0.001; // seconds

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(program);

    // set the view and projection matrices since
    // they are shared by all instances
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    gl.uniformMatrix4fv(projectionLoc, false,
        m4.orthographic(-aspect, aspect, -1, 1, -1, 1));
    gl.uniformMatrix4fv(viewLoc, false, m4.zRotation(time * .1));

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // update all the matrices
    matrices.forEach((mat, ndx) => {
      m4.translation(-0.5 + ndx * 0.25, 0, 0, mat);
      m4.zRotate(mat, time * (0.1 + 0.1 * ndx), mat);
    });

    // upload the new matrix data
    gl.bindBuffer(gl.ARRAY_BUFFER, matrixBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, matrixData);

    // set all 4 attributes for matrix
    const bytesPerMatrix = 4 * 16;
    for (let i = 0; i < 4; ++i) {
      const loc = matrixLoc + i;
      gl.enableVertexAttribArray(loc);
      // note the stride and offset
      const offset = i * 16;  // 4 floats per row, 4 bytes per float
      gl.vertexAttribPointer(
          loc,              // location
          4,                // size (num values to pull from buffer per iteration)
          gl.FLOAT,         // type of data in buffer
          false,            // normalize
          bytesPerMatrix,   // stride, num bytes to advance to get to next set of values
          offset,           // offset in buffer
      );
      // this line says this attribute only changes for each 1 instance
      ext.vertexAttribDivisorANGLE(loc, 1);
    }

    // set attribute for color
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);
    // this line says this attribute only changes for each 1 instance
    ext.vertexAttribDivisorANGLE(colorLoc, 1);

    ext.drawArraysInstancedANGLE(
      gl.TRIANGLES,
      0,             // offset
      numVertices,   // num vertices per instance
      numInstances,  // num instances
    );
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}