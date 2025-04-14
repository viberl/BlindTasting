import { Wine } from "lucide-react";
import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center">
              <Wine className="h-8 w-8 text-yellow-600" />
              <span className="ml-2 text-xl font-display font-bold">BlindSip</span>
            </div>
            <p className="mt-4 text-sm text-gray-400">
              BlindSip is the ultimate platform for wine enthusiasts to test their tasting skills, 
              discover new favorites, and enjoy blind tastings with friends and fellow wine lovers.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase">Resources</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/how-it-works">
                  <a className="text-sm text-gray-400 hover:text-white">How It Works</a>
                </Link>
              </li>
              <li>
                <Link href="/pricing">
                  <a className="text-sm text-gray-400 hover:text-white">Pricing</a>
                </Link>
              </li>
              <li>
                <Link href="/blog">
                  <a className="text-sm text-gray-400 hover:text-white">Blog</a>
                </Link>
              </li>
              <li>
                <Link href="/guides">
                  <a className="text-sm text-gray-400 hover:text-white">Wine Guides</a>
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase">Company</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/about">
                  <a className="text-sm text-gray-400 hover:text-white">About Us</a>
                </Link>
              </li>
              <li>
                <Link href="/contact">
                  <a className="text-sm text-gray-400 hover:text-white">Contact</a>
                </Link>
              </li>
              <li>
                <Link href="/privacy">
                  <a className="text-sm text-gray-400 hover:text-white">Privacy Policy</a>
                </Link>
              </li>
              <li>
                <Link href="/terms">
                  <a className="text-sm text-gray-400 hover:text-white">Terms of Service</a>
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-700">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} BlindSip. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
