# CS174A - Final Group Project

## Team member info

Xiao Yang 305346127
Zhengyang Liu 105114114

## Background

The main inspiration of our project comes from various modern AAA titles, such as DOOM and Anthem, which employs many advanced technologies while shading the environment. Our project simulates a rough rock surface populated by hot, molten lava.

![image-20210322004644604](C:\Users\cuoshen\AppData\Roaming\Typora\typora-user-images\image-20210322004644604.png)

## Introduction to Design and Implementation

Unlike many of the previous final project submission, our project put a stronger emphasis on the underlying rendering technology. First, we can't have lava without the underlying rocky surface, therefore we first give a basic implementation of a textured, normal mapped phong shader for the rocks. The rock texture comes from a free source online.

![image-20210322005147658](C:\Users\cuoshen\AppData\Roaming\Typora\typora-user-images\image-20210322005147658.png)

Note that the specular value has been toned up to a rather unrealistic value - so that we can easily verify that the normal mapping is working as intended.

Lava, just like any liquid, behaves in such a way that it fills all the volume below a certain height. We take advantage of this liquid-specific property to implement a procedural way of spawning and rendering lava given just an extra height map. The technical detail is discussed in the Advanced Features section below.

![image-20210322005531511](C:\Users\cuoshen\AppData\Roaming\Typora\typora-user-images\image-20210322005531511.png)

Given the static lava rendering, additional experimental techniques are also used to animate the result. Firstly, the lava color is interpolated between bright orange and red, linearly with respect to time, giving a "burning" expression to the lava. We also experimented using flow maps to manipulate the uv coordinate per fragment, which is detailed below.

## Advanced features

### Feature 1: height-generated lava



### Experimental feature 2: flow map



## Bonus: possible optimizations, and why we did not do that

Since we calculate height as distance directly above a fragment, only its x(or red) value is used. In the flow map, since it represents the speed vector of uv, only xy(rg) channels are used. We could potentially put height as the z(blue) channel in the flow map, thus reducing texture VRAM cost by a third by reducing one texture. We did not do that because it is potentially confusing for the reader.

## References

GDC 2019, Shading the World of Anthem (https://www.youtube.com/watch?v=IjQWRjWZGn0)

GDC 2018, Applying AAA Techniques on Mobile Games: Understanding Flow Maps and Its Applications (https://www.gdcvault.com/play/1025044/Applying-AAA-Techniques-on-Mobile)

Rock texture (https://3dtextures.me/2020/07/07/stylized-rocks-001/)

## Environment setup

This project is based directly on the given architecture, no additional setup is required.