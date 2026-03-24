#include "bindings/bindings.h"
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>

// ──────────────────────────────────────────────────────────────────────
// Fix: Force WKWebView to extend behind the iOS safe area (home bar).
//
// Tauri resets the WKWebView layout constraints AFTER app startup,
// overriding any one-shot fix. The solution: swizzle
// UIViewController's viewDidLayoutSubviews so our fix is reapplied
// every time iOS recalculates the layout — just like during rotation.
// ──────────────────────────────────────────────────────────────────────

static void fixWebViewInView(UIView *view, UIViewController *rootVC) {
    if ([view isKindOfClass:[WKWebView class]]) {
        WKWebView *webview = (WKWebView *)view;

        if (webview.scrollView.contentInsetAdjustmentBehavior != UIScrollViewContentInsetAdjustmentNever) {
            webview.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
        }

        if (rootVC.edgesForExtendedLayout != UIRectEdgeAll) {
            rootVC.edgesForExtendedLayout = UIRectEdgeAll;
            rootVC.extendedLayoutIncludesOpaqueBars = YES;
        }

        if (!UIEdgeInsetsEqualToEdgeInsets(rootVC.additionalSafeAreaInsets, UIEdgeInsetsZero)) {
            rootVC.additionalSafeAreaInsets = UIEdgeInsetsZero;
        }

        // Ensure webview fills its parent
        if (webview.superview && !CGRectEqualToRect(webview.frame, webview.superview.bounds)) {
            webview.frame = webview.superview.bounds;
            webview.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
        }
        return;
    }
    for (UIView *subview in view.subviews) {
        fixWebViewInView(subview, rootVC);
    }
}

// ── Swizzle UIViewController.viewDidLayoutSubviews ──────────────────
// This fires every time iOS recalculates layout — including after
// Tauri finishes its own WKWebView setup, which is exactly why
// one-shot fixes fail but rotation works.

static IMP sOriginalViewDidLayoutSubviews = NULL;

static void swizzled_viewDidLayoutSubviews(id self, SEL _cmd) {
    // Call original implementation first
    if (sOriginalViewDidLayoutSubviews) {
        ((void(*)(id, SEL))sOriginalViewDidLayoutSubviews)(self, _cmd);
    }

    // Only apply to root view controllers (not every VC in the hierarchy)
    UIViewController *vc = (UIViewController *)self;
    if (vc.view.window && vc == vc.view.window.rootViewController) {
        fixWebViewInView(vc.view, vc);
    }
}

__attribute__((constructor))
static void setupFullscreenHook(void) {
    // Swizzle UIViewController's viewDidLayoutSubviews
    Method original = class_getInstanceMethod([UIViewController class], @selector(viewDidLayoutSubviews));
    sOriginalViewDidLayoutSubviews = method_getImplementation(original);
    method_setImplementation(original, (IMP)swizzled_viewDidLayoutSubviews);
}

int main(int argc, char * argv[]) {
	ffi::start_app();
	return 0;
}
