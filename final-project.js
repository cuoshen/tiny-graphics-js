import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture,
} = tiny;

const {Cube, Phong_Shader, Textured_Phong} = defs;

export class Text_Line extends Shape                
{                           // **Text_Line** embeds text in the 3D world, using a crude texture 
                            // method.  This Shape is made of a horizontal arrangement of quads.
                            // Each is textured over with images of ASCII characters, spelling 
                            // out a string.  Usage:  Instantiate the Shape with the desired
                            // character line width.  Then assign it a single-line string by calling
                            // set_string("your string") on it. Draw the shape on a material
                            // with full ambient weight, and text.png assigned as its texture 
                            // file.  For multi-line strings, repeat this process and draw with
                            // a different matrix.
  constructor( max_size )
    { super( "position", "normal", "texture_coord" );
      this.max_size = max_size;
      var object_transform = Mat4.identity();
      for( var i = 0; i < max_size; i++ )
      {                                       // Each quad is a separate Square instance:
        defs.Square.insert_transformed_copy_into( this, [], object_transform );
        object_transform.post_multiply( Mat4.translation( 1.5,0,0 ) );
      }
    }
  set_string( line, context )
    {           // set_string():  Call this to overwrite the texture coordinates buffer with new 
                // values per quad, which enclose each of the string's characters.
      this.arrays.texture_coord = [];
      for( var i = 0; i < this.max_size; i++ )
        {
          var row = Math.floor( ( i < line.length ? line.charCodeAt( i ) : ' '.charCodeAt() ) / 16 ),
              col = Math.floor( ( i < line.length ? line.charCodeAt( i ) : ' '.charCodeAt() ) % 16 );

          var skip = 3, size = 32, sizefloor = size - skip;
          var dim = size * 16,  
              left  = (col * size + skip) / dim,      top    = (row * size + skip) / dim,
              right = (col * size + sizefloor) / dim, bottom = (row * size + sizefloor + 5) / dim;

          this.arrays.texture_coord.push( ...Vector.cast( [ left,  1-bottom], [ right, 1-bottom ],
                                                          [ left,  1-top   ], [ right, 1-top    ] ) );
        }
      if( !this.existing )
        { this.copy_onto_graphics_card( context );
          this.existing = true;
        }
      else
        this.copy_onto_graphics_card( context, ["texture_coord"], false );
    }
}


export class Final extends Scene {

    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        this.hasLava = true;
        this.lit = false;
        this.animatedLava = true;
        this.cube = true;
        this.lavaFlow = false;
        this.initial_lava_color = color(1.0, 69/256, 0.0, 1.0);
        this.current_lava_color = this.initial_lava_color;
        this.speed = vec3(0, 0, 0, 1);
        this.playerLocation = Mat4.identity().times(Mat4.translation(0, -4.25, -7.5, 1)).times(Mat4.scale(.4, .75, .4, 1));
        this.playerLocation = this.playerLocation.times(Mat4.rotation(0.5 * Math.PI, 1, 0, 0));
        this.score = 0;
        this.lives = 3;
        this.icecreamList = [];
        this.icecreamColors = [];
        this.icecreamSpeeds = [];
        this.lastSpawnTime = 0;
        this.gameOver = false;
        this.highScore = 0;

        this.shapes = {
            player: new defs.Cone_Tip(15, 15),
            cube: new Cube(),
            icecream: new defs.Subdivision_Sphere(4),
            text: new Text_Line( 35 )
        };

        // *** Materials
        this.materials = {
            phong: new Material(
            new Phong_Shader(), {
                color: color(1.0, 1.0, 0, 1.0),
                ambient: 1, diffusivity: 0, specularity: 0
            }
            ),
            cone: new Material(
            new Normal_Mapped(),{
                color: color(1.0,1.0,1.0,1.0),
                ambient: 0.8, diffusivity: .1, specularity: .1,
                albedo: new Texture("assets/waffle_color.jpg", "LINEAR_MIPMAP_LINEAR"),
                normal: new Texture("assets/waffle_normal.jpg", "LINEAR_MIPMAP_LINEAR")
                }
            ),
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
            flowing_lava: new Material(
            new Flow_Mapped(), {
                ambient: 0.5, diffusivity: 1.0, specularity: 10,
                albedo: new Texture("assets/rock_color.jpg","LINEAR_MIPMAP_LINEAR"),
                normal: new Texture("assets/rock_normal.jpg", "LINEAR_MIPMAP_LINEAR"),
                bump: new Texture("assets/rock_height.png", "LINEAR_MIPMAP_LINEAR"),
                lava_color: color(1.0, 69/256, 0.0, 1.0),
                lava_threshold: 0.3,
                flowmap: new Texture("assets/flowmap.png", "LINEAR_MIPMAP_LINEAR"),
                flow_speed: 1.0,
                time: 0.0
            }
            )
        }
        const texture = new defs.Textured_Phong( 1 );
        this.text_image = new Material( texture, { ambient: 1, diffusivity: 0, specularity: 0,
                                                 texture: new Texture( "assets/text.png" ) });

        this.initial_camera_location = Mat4.look_at(vec3(0, 30, 10), vec3(0, 10, 0), vec3(0, 1, 0));
        this.initial_camera_location = this.initial_camera_location.times(Mat4.translation(0, 15, 7.5, 1));
    }

    make_control_panel() {
        this.key_triggered_button("Toggle Lava", ["Control", "1"], () => this.hasLava = !this.hasLava);
        this.new_line();
        this.key_triggered_button("Toggle Highlight", ["Control", "2"], () => this.lit = !this.lit);
        this.new_line();
        this.key_triggered_button("Toggle Lava Color Blending", ["Control", "3"], () => this.animatedLava = !this.animatedLava);
        this.new_line();
        this.key_triggered_button("Toggle Lava Flow", ["Control", "4"], () => this.lavaFlow = !this.lavaFlow);
        this.new_line();
        this.key_triggered_button( "Forward", [ "w" ], () => this.speed[2] = -.4, undefined, () => this.speed[2] = 0 );
        this.key_triggered_button( "Back", [ "s" ], () => this.speed[2] = .4, undefined, () => this.speed[2] = 0 );
        this.key_triggered_button( "Left", [ "a" ], () => this.speed[0] = -.4, undefined, () => this.speed[0] = 0 );
        this.key_triggered_button( "Right", [ "d" ], () => this.speed[0] = .4, undefined, () => this.speed[0] = 0 );
        this.new_line();
        this.key_triggered_button("Restart", ["r"], () => {
            this.gameOver = false;
            this.lives = 3;
            this.score = 0;
            this.icecreamList = [];
            this.icecreamColors = [];
            this.icecreamSpeeds = [];
        });
    }

    interpolate_lava_color(t) {
        let lambda = (1 + Math.cos(t));
        return (color(1.0, 20/256 + lambda * 40/256, 0, 1,0));
    }

    spawnIceCream() {
        //x between -6.5 to 6.5, z -14 to -1
        let model_transform = Mat4.identity().times(Mat4.translation(Math.random() * 13 - 6.5, 2, Math.random() * 13 -14, 1)).times(Mat4.scale(0.5, 0.5, 0.5, 1));
        this.icecreamList.push(model_transform);
        let icecreamColor = color(0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, 1);
        this.icecreamColors.push(icecreamColor);
        let speed = -0.15 + Math.random() * 0.1;
        this.icecreamSpeeds.push(speed);
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
            program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 10)];
        }

        //Draw

        if (this.animatedLava) {
            this.current_lava_color = this.interpolate_lava_color(t);
        }

        if (this.hasLava) {
            if (this.lavaFlow){
                this.activeMaterial = this.materials.flowing_lava.override({lava_color: this.current_lava_color, time: t});
            } else {
                this.activeMaterial = this.materials.bump_mapped_lava.override({lava_color: this.current_lava_color});
            }
        } else {
            this.activeMaterial = this.materials.normal_mapped_stone;
        }
        model_transform = model_transform.times(Mat4.translation(0, -5, -7.5, 1)).times(Mat4.scale(7.5, 0.01, 7.5, 1));
        this.shapes.cube.draw(context, program_state, model_transform, this.activeMaterial);

        if(this.playerLocation[0][3] > 7.1) {
            this.playerLocation[0][3] = 7.1;
        }
        else if(this.playerLocation[0][3] < -7.1) {
            this.playerLocation[0][3] = -7.1;
        }
        if(this.playerLocation[2][3] > -0.4) {
            this.playerLocation[2][3] = -0.4;
        }
        else if(this.playerLocation[2][3] < -14.6) {
            this.playerLocation[2][3] = -14.6;
        }
        this.playerLocation = this.playerLocation.times(Mat4.rotation(-0.5 * Math.PI, 1, 0, 0)).times( Mat4.translation(...this.speed) ).times(Mat4.rotation(0.5 * Math.PI, 1, 0, 0));
        this.shapes.player.draw(context, program_state, this.playerLocation, this.materials.cone);
        
        //Game Logic
        if(this.lives <= 0 && !this.gameOver) {
            this.gameOver = true;
            this.highScore = Math.max(this.highScore, this.score);
            this.icecreamList = [];
            this.icecreamColors = [];
            this.icecreamSpeeds = [];
        }
        if(t > this.lastSpawnTime + 2 && !this.gameOver) {
            this.lastSpawnTime = t;
            this.spawnIceCream();
        }
        let i = 0;
        for(i = 0; i < this.icecreamList.length; i++) {
            let y = this.icecreamList[i][1][3];
            let x = this.icecreamList[i][0][3];
            let z = this.icecreamList[i][2][3];
            let playerX = this.playerLocation[0][3];
            let playerZ = this.playerLocation[2][3];

            if(y > -5.5 && y < -3.65 && x < playerX + 0.6 && x > playerX - 0.6 && z > playerZ - 0.6 && z < playerZ + 0.6) {
                this.score = this.score + 1;
                this.icecreamList.splice(i, 1);
                this.icecreamColors.splice(i, 1);
                this.icecreamSpeeds.splice(i, 1);
            }
        }
        for (i = 0; i < this.icecreamList.length; i++) {
            if(this.icecreamList[i][1][3] < -6.0) {
                this.lives = this.lives - 1;
                this.icecreamList.splice(i, 1);
                this.icecreamColors.splice(i, 1);
                this.icecreamSpeeds.splice(i, 1);
            }
        }
        for (i = 0; i < this.icecreamList.length; i++) {
            this.shapes.icecream.draw(context, program_state, this.icecreamList[i], this.materials.phong.override({color: this.icecreamColors[i]}));
            this.icecreamList[i] = this.icecreamList[i].times(Mat4.translation(0, this.icecreamSpeeds[i], 0, 1));
        }
        let textLocation = Mat4.look_at(vec3(0, -30, 10), vec3(0, 10, 0), vec3(0, 1, 0));
        textLocation = textLocation.times(Mat4.translation(-10, -30, 10, 1));
        this.shapes.text.set_string( `Score: ${this.score}`, context.context );
        this.shapes.text.draw( context, program_state, textLocation.times(Mat4.scale(0.5, 0.5, 0.5, 1)), this.text_image );
        textLocation = textLocation.times(Mat4.translation(0, -1, 0, 1));
        this.shapes.text.set_string( `Lives: ${this.lives}`, context.context );
        this.shapes.text.draw( context, program_state, textLocation.times(Mat4.scale(0.5, 0.5, 0.5, 1)), this.text_image );
        if(this.gameOver) {
            textLocation = textLocation.times(Mat4.translation(5, 6.5, 0, 1))
            this.shapes.text.set_string(`High Score: ${this.highScore}`, context.context);
            this.shapes.text.draw( context, program_state, textLocation.times(Mat4.scale(0.5, 0.5, 0.5, 1)), this.text_image );
            textLocation = textLocation.times(Mat4.translation(-1, -1.5, 0, 1));
            this.shapes.text.set_string( "GAME OVER", context.context );
            this.shapes.text.draw( context, program_state, textLocation, this.text_image );
            textLocation = textLocation.times(Mat4.translation(-0.25, -1, 0, 1));
            this.shapes.text.set_string( "Press r to restart", context.context );
            this.shapes.text.draw( context, program_state, textLocation.times(Mat4.scale(0.5, 0.5, 0.5, 1)), this.text_image );
        }
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

class Flow_Mapped extends Bump_Mapped {

    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D albedo;
            uniform sampler2D normal_map;
            uniform sampler2D bump;
            uniform sampler2D flow_map;
            uniform vec4 lava_color;
            uniform float lava_threshold;
            uniform float time;
            uniform float flow_speed;
            
            void main(){
                vec2 flow_uv = f_tex_coord;
                vec2 uv_displacement = texture2D(flow_map, f_tex_coord).xy; // Sample displacement from flow map
                uv_displacement -= vec2(0.5, 0.5); // Convert flow range from [0,1] to [-0.5, 0.5]
                flow_uv += uv_displacement * flow_speed * time; // Compute final uv used for all other texture

                vec4 tex_color = texture2D( albedo, flow_uv);

                vec4 normal_sample = texture2D(normal_map, flow_uv);
                vec3 normal = normalize(normal_sample.xyz);

                vec3 bumped = vertex_worldspace;
                vec4 bump_sample = texture2D(bump, flow_uv);
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
      if (material.flowmap && material.flowmap.ready) 
      {
         context.uniform1i(gpu_addresses.flow_map, 3);
         material.flowmap.activate(context, 3); 
         context.uniform1f(gpu_addresses.flow_speed, material.flow_speed);
         context.uniform1f(gpu_addresses.time, material.time);
      }
    }
}