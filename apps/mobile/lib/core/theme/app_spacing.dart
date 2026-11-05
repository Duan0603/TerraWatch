import 'package:flutter/material.dart';

/// Design tokens ve khoang cach (Spacing) & bo goc (Radius)
class AppSpacing {
  AppSpacing._();

  static const double xxs = 2.0;
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 12.0;
  static const double lg = 16.0;
  static const double xl = 20.0;
  static const double xxl = 24.0;
  static const double xxxl = 32.0;
  static const double hero = 48.0;

  // EdgeInsets helpers
  static const EdgeInsets p4 = EdgeInsets.all(xs);
  static const EdgeInsets p8 = EdgeInsets.all(sm);
  static const EdgeInsets p12 = EdgeInsets.all(md);
  static const EdgeInsets p16 = EdgeInsets.all(lg);
  static const EdgeInsets p20 = EdgeInsets.all(xl);
  static const EdgeInsets p24 = EdgeInsets.all(xxl);

  static const EdgeInsets px16 = EdgeInsets.symmetric(horizontal: lg);
  static const EdgeInsets py12 = EdgeInsets.symmetric(vertical: md);
  static const EdgeInsets py16 = EdgeInsets.symmetric(vertical: lg);
  static const EdgeInsets screenPadding = EdgeInsets.symmetric(horizontal: lg, vertical: md);
}

/// Design tokens ve do cong bo goc (BorderRadius)
class AppRadius {
  AppRadius._();

  static const double xs = 4.0;
  static const double sm = 6.0;
  static const double md = 10.0;
  static const double lg = 14.0;
  static const double xl = 18.0;
  static const double xxl = 24.0;
  static const double pill = 999.0;

  static final BorderRadius r4 = BorderRadius.circular(xs);
  static final BorderRadius r6 = BorderRadius.circular(sm);
  static final BorderRadius r10 = BorderRadius.circular(md);
  static final BorderRadius r14 = BorderRadius.circular(lg);
  static final BorderRadius r18 = BorderRadius.circular(xl);
  static final BorderRadius r24 = BorderRadius.circular(xxl);
  static final BorderRadius rPill = BorderRadius.circular(pill);
}

/// Design tokens ve do do bong (BoxShadow)
class AppShadows {
  AppShadows._();

  static const List<BoxShadow> card = [
    BoxShadow(
      color: Color.fromRGBO(23, 37, 36, 0.04),
      blurRadius: 8,
      offset: Offset(0, 2),
    ),
  ];

  static const List<BoxShadow> floating = [
    BoxShadow(
      color: Color.fromRGBO(23, 37, 36, 0.08),
      blurRadius: 16,
      offset: Offset(0, 4),
    ),
  ];

  static const List<BoxShadow> emergencyGlow = [
    BoxShadow(
      color: Color.fromRGBO(239, 68, 68, 0.35),
      blurRadius: 20,
      spreadRadius: 2,
      offset: Offset(0, 4),
    ),
  ];
}
