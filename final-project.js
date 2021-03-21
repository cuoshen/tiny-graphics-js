import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture,
} = tiny;

const {Cube, Phong_Shader, Textured_Phong} = defs;

export class Final extends Scene {

    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        this.hasLava = false;
        this.lit = true;
        this.animatedLava = false;
        this.initial_lava_color = color(1.0, 69/256, 0.0, 1.0);
        this.current_lava_color = this.initial_lava_color;

        this.shapes = {
            sphere: new defs.Subdivision_Sphere(4),
            cube: new Cube()
        };

        // *** Materials
        this.materials = {
            phong: new Material(new Phong_Shader(),{
                color: color(1.0,1.0,1.0,1.0),
                ambient: .0, diffusivity: 1.0, specularity: 0.1}),
            normal_mapped_stone: new Material(
            new Normal_Mapped(), {
                ambient: 0.5, diffusivity: 1.0, specularity: 10,
                albedo: new Texture("assets/rock_color.jpg","LINEAR_MIPMAP_LINEAR"),
                normal: new Texture("assets/rock_normal.jpg", "LINEAR_MIPMAP_LINEAR")
                }
            ),
            bump_mapped_lava: new Material(
            new Bump_Mapped(), {
                ambient: 0.5, diffusivity: 1.0, specularity: 10,
                albedo: new Texture("assets/rock_color.jpg","LINEAR_MIPMAP_LINEAR"),
                normal: new Texture("assets/rock_normal.jpg", "LINEAR_MIPMAP_LINEAR"),
                bump: new Texture("assets/rock_height.png", "LINEAR_MIPMAP_LINEAR"),
                lava_color: color(1.0, 69/256, 0.0, 1.0),
                lava_threshold: 0.3
                }
            ),
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 10), vec3(0, 0, 0), vec3(0, 1, 0));
    }

    make_control_panel() {
        this.key_triggered_button("Toggle Lava", ["Control", "0"], () => this.hasLava = !this.hasLava);
        this.new_line();
        this.key_triggered_button("Toggle Highlight", ["Control", "0"], () => this.lit = !this.lit);
        this.new_line();
        this.key_triggered_button("Toggle Lava Color Blending", ["Control", "0"], () => this.animatedLava = !this.animatedLava);
        this.new_line();
    }

    interpolate_lava_color(t) {
        let lambda = 0.5*(1 + Math.cos(t * 2.0));
        return (color(1.0, lambda * 120/256, lambda * 100/256, 1,0));
    }

    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        let model_transform = Mat4.identity();
        
        //Lighting
        const light_position = vec4(3, 3, 0, 1);
        if (this.lit){
            program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];
        } else {
            program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 0)];
        }

        //Sphere
        model_transform = model_transform.times(Mat4.rotation(t,1,1,1));

        if (this.animatedLava) {
            this.current_lava_color = this.interpolate_lava_color(t);
        }

        if (this.hasLava) {
            this.activeMaterial = this.materials.bump_mapped_lava.override({lava_color: this.current_lava_color});
        } else {
            this.activeMaterial = this.materials.normal_mapped_stone;
        }
        this.shapes.cube.draw(context, program_state, model_transform, this.activeMaterial);
    }
}

class Normal_Mapped extends Phong_Shader {

    vertex_glsl_code() { 
        return this.shared_glsl_code() + `
        varying vec2 f_tex_coord;
        attribute vec3 position, normal;
        attribute vec2 texture_coord;
        
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main()
          {
            gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
            N = normalize( mat3( model_transform ) * normal / squared_scale);   // True normal
            vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
            f_tex_coord = texture_coord;
          } ` ;
    }

    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D albedo;
            uniform sampler2D normal_map;
            
            void main(){
                vec4 tex_color = texture2D( albedo, f_tex_coord);

                vec4 normal_sample = texture2D(normal_map, f_tex_coord);
                vec3 normal = normalize(normal_sample.xyz);

                if( tex_color.w < .01 ) discard;
                gl_FragColor = vec4(tex_color.xyz * ambient, tex_color.w);
                gl_FragColor.xyz += phong_model_lights( normalize( normal ), vertex_worldspace );
        } `;
    }

    update_GPU( context, gpu_addresses, gpu_state, model_transform, material )
    {             // update_GPU(): Add a little more to the base class's version of this method.                
      super.update_GPU( context, gpu_addresses, gpu_state, model_transform, material );
                                               
      if( material.albedo && material.albedo.ready )
      {
        context.uniform1i( gpu_addresses.albedo, 0);
                                  // For this draw, use the texture image from correct the GPU buffer:
        material.albedo.activate(context, 0);
      }

      // Apply normal map
      if ( material.normal && material.normal.ready )
      {
          context.uniform1i(gpu_addresses.normal_map, 1);
          material.normal.activate(context, 1);
      }
    }
}

class Bump_Mapped extends Phong_Shader {

    vertex_glsl_code() { 
        return this.shared_glsl_code() + `
        varying vec2 f_tex_coord;
        attribute vec3 position, normal;
        attribute vec2 texture_coord;
        
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main()
          {
            gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
            N = normalize( mat3( model_transform ) * normal / squared_scale);   // True normal
            vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
            f_tex_coord = texture_coord;
          } ` ;
    }

    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D albedo;
            uniform sampler2D normal_map;
            uniform sampler2D bump;
            uniform vec4 lava_color;
            uniform float lava_threshold;
            
            void main(){
                vec4 tex_color = texture2D( albedo, f_tex_coord);

                vec4 normal_sample = texture2D(normal_map, f_tex_coord);
                vec3 normal = normalize(normal_sample.xyz);

                vec3 bumped = vertex_worldspace;
                vec4 bump_sample = texture2D(bump, f_tex_coord);
                bumped += N.xyz * bump_sample.x; // bump by true normal

                if( tex_color.w < .01 ) discard;
                gl_FragColor = vec4(tex_color.xyz * ambient, tex_color.w);
                gl_FragColor.xyz += phong_model_lights( normalize( normal ), bumped );

                float height = bump_sample.x;
                if (height < lava_threshold) {
                    gl_FragColor = mix(lava_color, vec4(0.0,0.0,0.0,1.0), height*(1.0/lava_threshold));
                }
        } `;
    }

    update_GPU( context, gpu_addresses, gpu_state, model_transform, material )
    {             // update_GPU(): Add a little more to the base class's version of this method.                
      super.update_GPU( context, gpu_addresses, gpu_state, model_transform, material );
                                               
      if( material.albedo && material.albedo.ready )
      {
        context.uniform1i( gpu_addresses.albedo, 0);
                                  // For this draw, use the texture image from correct the GPU buffer:
        material.albedo.activate(context, 0);
      }

      // Apply normal map
      if ( material.normal && material.normal.ready )
      {
          context.uniform1i(gpu_addresses.normal_map, 1);
          material.normal.activate(context, 1);
      }

      if (material.bump && material.bump.ready) 
      {
         context.uniform1i(gpu_addresses.bump, 2);
         material.bump.activate(context, 2); 
      }

      context.uniform4fv(gpu_addresses.lava_color, material.lava_color);
      context.uniform1f(gpu_addresses.lava_threshold, material.lava_threshold);
    }
}