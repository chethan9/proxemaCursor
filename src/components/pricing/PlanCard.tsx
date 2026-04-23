import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/compo
...
loading ? "Processing..." : plan.trial_days > 0 ? `Start ${plan.trial_days}-day trial` : "Subscribe"}
        </Button>
      </CardContent>
    </Card>
  );
}