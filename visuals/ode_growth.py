"""Original optional Manim Community scene. Render in a separate trusted environment.

manim -pql visuals/ode_growth.py LocalRuleToCurve

Manim and its native dependencies are optional; they are not installed in the web image.
This file is authored code, never a template for executing arbitrary model output.
"""
from manim import Axes, Create, Dot, FadeIn, FadeOut, MathTex, Scene, Text, VGroup, Write


class LocalRuleToCurve(Scene):
    def construct(self):
        question = Text("How does a local rule become a whole curve?", font_size=28).to_edge([0, 1, 0])
        rule = MathTex(r"x'(t)=kx(t),\quad x(0)=x_0").next_to(question, [0, -1, 0])
        axes = Axes(x_range=[0, 4, 1], y_range=[0, 5, 1], x_length=8, y_length=4).shift([0, -.7, 0])
        self.play(Write(question), Write(rule))
        self.play(Create(axes))
        point = Dot(axes.c2p(0, 1))
        self.play(FadeIn(point))
        import math
        curve = axes.plot(lambda t: math.exp(.35*t), x_range=[0, 4], color="#9EC8A0")
        self.play(Create(curve), run_time=4)
        formula = MathTex(r"x(t)=x_0e^{kt}").to_edge([0, -1, 0])
        self.play(Write(formula))
        self.wait(2)
        self.play(FadeOut(VGroup(question, rule, axes, curve, point, formula)))
        check = MathTex(r"\frac{d}{dt}\big(e^{-kt}x(t)\big)=e^{-kt}(x'-kx)=0")
        self.play(Write(check))
        self.wait(3)
