import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture,
} = tiny;

const {Cube, Phong_Shader, Textured_Phong} = defs;

export class Final extends Scene {

    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            sphere: new defs.Subdivision_Sphere(4),
            cube: new Cube()
        };

        // *** Materials
        this.materials = {
            phong: new Material(new Phong_Shader(),{
                color: color(1.0,1.0,1.0,1.0),
                ambient: .5, diffusivity: 0.1, specularity: 0.1}),
            normal_mapped: new Material(
            new CustomShader(), {
                ambient: .5, diffusivity: 0.1, specularity: 0.1,
                albedo: new Texture("assets/wood_color.jpg","LINEAR_MIPMAP_LINEAR"),
                normal: new Texture("assets/wood_normal.jpg", "LINEAR_MIPMAP_LINEAR")
                }
            ),
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 10), vec3(0, 0, 0), vec3(0, 1, 0));
    }

    make_control_panel() {
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
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        //Sphere
        this.shapes.sphere.draw(context, program_state, model_transform, this.materials.normal_mapped);
    }
}

class CustomShader extends Phong_Shader {

    vertex_glsl_code() { 
        return this.shared_glsl_code() + `
        varying vec2 f_tex_coord;
        attribute vec3 position, normal;
        attribute vec2 texture_coord;
        
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main()
          {                                                                   // The vertex's final resting place (in NDCS):
            gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                                                                              // The final normal vector in screen space.
            N = normalize( mat3( model_transform ) * normal / squared_scale);
            
            vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                                              // Turn the per-vertex texture coordinate into an interpolated variable.
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

                vec4 normal_sample = texture2D(albedo, f_tex_coord);
                vec3 normal = normalize(normal_sample.xyz);

                if( tex_color.w < .01 ) discard;
                                                                         // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                         // Compute the final color with contributions from lights:
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

